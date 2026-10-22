import { writeFile } from 'node:fs/promises';

const COLORS = { ivory: '#e9e1cc', gold: '#d8b56f', sage: '#708c87' };
const marks = {
  gonsama: [
    { color: COLORS.ivory, outline: 'M64 18 54 8H26L12 22V42L26 56H54L68 42V30H42V38H58V40L50 48H30L20 38V26L30 16H50L58 24Z' },
    { color: COLORS.gold, outline: 'M42 30H68V42L54 56H26L18 48H50L58 40V38H42Z' },
  ],
  ethan: [
    { color: COLORS.ivory, outline: 'M10 10H34V18H18V28H30V36H18V46H34V54H10Z' },
    { color: COLORS.sage, outline: 'M42 10H70V42L58 54H46L38 46V36H46V42L50 46H54L62 38V18H42Z' },
  ],
};

for (const [name, shapes] of Object.entries(marks)) {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="64" viewBox="0 0 80 64">',
    ...shapes.map(({ color, outline }) => `  <path fill="${color}" d="${outline}"/>`),
    '</svg>',
    '',
  ].join('\n');
  await writeFile(new URL(`../art/opening/${name}.svg`, import.meta.url), svg);
  console.log(`${name}.svg: 80x64 transparent standalone mark, ${shapes.length} flat paths`);
}
