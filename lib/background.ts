import type {
  Background,
  Dataset,
  Occupation,
  Prefills,
  SearchItem,
  SkillConnection,
} from './career';

// ponytail: these editable interest links are suggestions, not a validated assessment.
// Unrecognized interests stay unmapped; users can supply their own skill links.
const INTEREST_SKILLS: [RegExp, string[]][] = [
  [
    /\b(programming|coding|software development|rom hacking|retrocomputing)\b/i,
    ['Programming', 'Troubleshooting', 'Complex Problem Solving'],
  ],
  [
    /\b(robotics|electronics|amateur radio|model engineering|3d printing)\b/i,
    ['Technology Design', 'Equipment Selection', 'Troubleshooting'],
  ],
  [
    /\b(woodworking|carpentry|welding|do.it.yourselfing|repairing|maker culture)\b/i,
    [
      'Equipment Selection',
      'Operation and Control',
      'Quality Control Analysis',
    ],
  ],
  [
    /\b(photography|photographer|video production|drone flying)\b/i,
    ['Equipment Selection', 'Operation and Control', 'Technology Design'],
  ],
  [
    /\b(writing|writer|poetry|conlanging|blogging|letterhack|postcrossing)\b/i,
    ['Writing', 'Reading Comprehension'],
  ],
  [
    /\b(reading|genealogy|genealogist|historian|archaeology|wikimedia)\b/i,
    ['Reading Comprehension', 'Critical Thinking', 'Writing'],
  ],
  [
    /\b(astronomy|chemistry|geology|science|fossil|beekeeping)\b/i,
    ['Science', 'Critical Thinking', 'Monitoring'],
  ],
  [
    /\b(gardening|bonsai|seed growing|fishkeeping|ant keeping|pigeon keeping|animal fancy)\b/i,
    ['Monitoring', 'Science', 'Judgment and Decision Making'],
  ],
  [
    /\b(cooking|baking|soap.making|candlemaking)\b/i,
    ['Time Management', 'Monitoring', 'Quality Control Analysis'],
  ],
  [
    /\b(chess|xiangqi|sudoku|crossword|jigsaw puzzle|backgammon|board game|card game|argument diagram|mathematics)\b/i,
    ['Critical Thinking', 'Complex Problem Solving'],
  ],
  [
    /\b(coaching|teaching|tutoring|mentoring)\b/i,
    ['Instructing', 'Learning Strategies', 'Active Listening'],
  ],
  [
    /\b(public speaking|science communication|theater|theatre|role.playing game|streamer|content creator)\b/i,
    ['Speaking', 'Social Perceptiveness'],
  ],
  [
    /\b(volunteering|community service|caregiving)\b/i,
    ['Service Orientation', 'Active Listening', 'Social Perceptiveness'],
  ],
  [
    /\b(marketing|fundraising|debating)\b/i,
    ['Persuasion', 'Speaking', 'Negotiation'],
  ],
  [
    /\b(budgeting|accounting|investing)\b/i,
    ['Mathematics', 'Management of Financial Resources'],
  ],
  [
    /\b(organizing|event planning|leadership)\b/i,
    ['Coordination', 'Time Management', 'Management of Personnel Resources'],
  ],
  [
    /\b(sewing|knitting|crocheting|weaving|quilting|embroidery|leather crafting|model building|origami|pottery|ceramic art)\b/i,
    ['Quality Control Analysis', 'Equipment Selection'],
  ],
  [
    /\b(graphic design|jewelry design|floral design|painting|sculpture|calligraphy)\b/i,
    ['Operations Analysis', 'Equipment Selection'],
  ],
  [
    /\b(sailing|scuba diving|caving|mountain biking|hang gliding|kart racing|motorcycling)\b/i,
    ['Operation and Control', 'Judgment and Decision Making'],
  ],
];

export const backgroundKey = (field: string, name: string) =>
  `${field}:${name.trim().normalize('NFKC').toLowerCase()}`;
export type BackgroundConnection = SkillConnection & {
  field: keyof Background;
  occupations: string[];
  basis: string;
  url?: string;
  item?: SearchItem;
};

export function connectBackground(
  background: Background,
  prefills: Prefills | null,
  data: Dataset | null,
  overrides: Record<string, string[]> = {},
): BackgroundConnection[] {
  const skills = data?.skills ?? [];
  const occupations = data?.occupations ?? [];
  const roleIds = new Set(occupations.map((o) => o.id));
  const average = (values: number[]) =>
    values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  const baseline = skills.map((_, index) =>
    average(
      occupations.flatMap((o) =>
        o.importance[index] == null ? [] : [o.importance[index]!],
      ),
    ),
  );
  return Object.entries(background).flatMap(([field, value]) => {
    if (field === 'physical') return []; // Support notes never imply skills or medical eligibility.
    return [
      ...new Set(
        value
          .split('\n')
          .map((name) => name.trim())
          .filter(Boolean),
      ),
    ].map((name) => {
      const id = backgroundKey(field, name);
      const catalog = prefills?.[field as keyof Prefills];
      const item = catalog?.items.find(
        (i) => backgroundKey(field, i.name) === id,
      );
      const linkedRoles = (item?.occupations ?? []).filter((id) =>
        roleIds.has(id),
      );
      let suggested: string[] = [];
      if (linkedRoles.length) {
        const related = occupations.filter((o) => linkedRoles.includes(o.id));
        const demand = skills.map((_, index) => {
          const values = related.flatMap((o) =>
            o.importance[index] == null ? [] : [o.importance[index]!],
          );
          const importance = average(values);
          return {
            id: String(index),
            importance,
            relative: importance - baseline[index],
          };
        });
        const measured = demand.filter((s) => s.importance >= 2.5);
        // Include distinctive demands (e.g. Programming), not only widely used communication skills.
        suggested = [
          ...new Set(
            [
              ...[...measured]
                .sort((a, b) => b.importance - a.importance)
                .slice(0, 4),
              ...measured
                .filter((s) => s.relative > 0)
                .sort((a, b) => b.relative - a.relative)
                .slice(0, 4),
            ].map((s) => s.id),
          ),
        ];
      } else if (
        ['hobbies', 'talents', 'athletics', 'training'].includes(field)
      ) {
        const names = new Set(
          INTEREST_SKILLS.filter(([pattern]) => pattern.test(name)).flatMap(
            ([, names]) => names,
          ),
        );
        suggested = skills.flatMap((skill, index) =>
          names.has(skill.name) ? [String(index)] : [],
        );
      }
      const manual = Object.hasOwn(overrides, id);
      return {
        id,
        field: field as keyof Background,
        name,
        item,
        occupations: linkedRoles,
        skills: [...new Set(manual ? overrides[id] : suggested)].filter(
          (id) => /^\d+$/.test(id) && !!skills[Number(id)],
        ),
        basis:
          field === 'source' && item
            ? 'IPEDS reported fields'
            : linkedRoles.length
              ? field === 'major'
                ? 'NCES field → occupation'
                : 'CareerOneStop direct occupation link'
              : suggested.length
                ? 'Suggested interest → skill link'
                : 'No automatic mapping',
        url:
          field === 'major' || field === 'training' || field === 'source'
            ? catalog?.url
            : undefined,
      };
    });
  });
}

export function connectionStrength(
  o: Occupation,
  connection: BackgroundConnection,
) {
  if (connection.occupations.includes(o.id)) return 2;
  if (!connection.skills.length) return 0;
  // Interest similarity orders equally fitting paths; it never supplies a proficiency rating.
  return (
    connection.skills.reduce(
      (sum, id) =>
        sum +
        ((o.importance[Number(id)] ?? 0) >= 3
          ? (o.importance[Number(id)] ?? 0) / 5
          : 0),
      0,
    ) / connection.skills.length
  );
}

export function schoolPrograms(connections: BackgroundConnection[]) {
  return new Set(
    connections
      .filter((c) => c.field === 'source')
      .flatMap((c) => c.item?.programs?.map((p) => p.id) ?? []),
  );
}

export function schoolMajorEvidence(
  school: SearchItem | undefined,
  major: SearchItem | undefined,
  education: number,
) {
  const program = school?.programs?.find((p) => p.id === major?.id);
  if (!program)
    return 'No award record for this field in the 2024 snapshot; other years and programs may be missing.';
  // IPEDS award categories retained separately from the user's education/preparation proxy.
  const awards: Record<number, number[]> = {
    3: [2, 3, 4, 20, 21],
    4: [5],
    5: [7],
    6: [17],
    7: [18],
  };
  const level = awards[education];
  if (!level)
    return 'Awards reported in this field. Choose your degree level to compare the record.';
  return program.awards.some((award) => level.includes(award))
    ? 'Awards reported in this field at your selected degree level (2024).'
    : 'Awards reported in this field, but not at your selected degree level in this snapshot.';
}
