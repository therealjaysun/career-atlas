import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import {
  pickerSuggestions,
  searchOccupations,
  validPrefills,
  clusterLabels,
} from '../lib/career.ts';
const data = JSON.parse(
  readFileSync(new URL('../public/onet.json', import.meta.url)),
);
const prefills = JSON.parse(
  readFileSync(new URL('../public/background-options.json', import.meta.url)),
);
const median = (samples) =>
  samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];
function measure(run) {
  run();
  return +median(
    Array.from({ length: 7 }, () => {
      const start = performance.now();
      run();
      return performance.now() - start;
    }),
  ).toFixed(3);
}
function assets(directory) {
  return readdirSync(directory).flatMap((file) => {
    const path = `${directory}/${file}`;
    return statSync(path).isDirectory() ? assets(path) : [path];
  });
}
const files = assets(new URL('../dist/client', import.meta.url).pathname);
const report = {
  node: process.version,
  medianMs: {
    emptyCatalogPicker: measure(() =>
      pickerSuggestions(prefills.source.items, ''),
    ),
    schoolSearch: measure(() =>
      pickerSuggestions(prefills.source.items, 'stanford', [], true),
    ),
    fuzzyCertification: measure(() =>
      pickerSuggestions(
        prefills.training.items,
        'certifed profesional',
        [],
        true,
      ),
    ),
    occupationSearch: measure(() =>
      searchOccupations(data.occupations, 'software enginer', null, 0),
    ),
    catalogValidation: measure(() => validPrefills(prefills)),
    labels: measure(() => clusterLabels(data.clusters, 1)),
  },
  assets: Object.fromEntries(
    ['js', 'css'].map((extension) => {
      const buffers = files
        .filter((path) => path.endsWith(`.${extension}`))
        .map((path) => readFileSync(path));
      return [
        extension,
        {
          files: buffers.length,
          bytes: buffers.reduce((sum, b) => sum + b.length, 0),
          gzipBytes: buffers.reduce((sum, b) => sum + gzipSync(b).length, 0),
        },
      ];
    }),
  ),
  dataBytes: Object.fromEntries(
    ['onet', 'background-options'].map((name) => {
      const buffer = readFileSync(
        new URL(`../public/${name}.json`, import.meta.url),
      );
      return [
        name,
        { bytes: buffer.length, gzipBytes: gzipSync(buffer).length },
      ];
    }),
  ),
};
console.log(JSON.stringify(report, null, 2));
if (process.argv[2])
  writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
