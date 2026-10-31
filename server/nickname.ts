// Count UTF-16 units conservatively; truncate only at complete grapheme boundaries.
export function renderNickname(template: string, original: string, max = 32) {
  if (!Number.isInteger(max) || max < 1) throw Error('INVALID_NICKNAME_LIMIT');
  if (/@everyone|@here|<[@#][^>]*>/i.test(template)) throw Error('NICKNAME_MENTION');
  const parts = template.split('{name}');
  if (parts.length > 2) throw Error('MULTIPLE_NAME_PLACEHOLDERS');
  const before = parts[0],
    after = parts[1] ?? '';
  const fixed = before.length + after.length;
  if (fixed > max) throw Error('TEMPLATE_TOO_LONG');
  const name = original.replace(/@/g, '＠').replace(/</g, '＜').replace(/>/g, '＞');
  if (fixed + name.length <= max) return before + name + after;
  let out = '';
  for (const { segment } of new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(name)) {
    if (fixed + out.length + segment.length + 1 > max) break;
    out += segment;
  }
  return before + out + (fixed < max ? '…' : '') + after;
}
export const safeNickname = renderNickname;
export function visibleReport(report: string[]): string[] {
  return report.filter((line) => !/内部状态|内部称号|已获得状态/.test(line));
}
export const opportunityNames: Record<string, string> = {
  priority_confession: '优先排队',
  hell_reroll_token: '地狱重抽',
  free_reroll: '免费重抽',
  judgment_redraw_token: '请求重判',
  command_skip_token: '跳过一次仪式',
  lucky_chip: 'R 级免罚',
  storm_protection: '天堂保护',
  ren_protection: '山城恋保护',
  jackpot_protection: 'JACKPOT 保护',
};
