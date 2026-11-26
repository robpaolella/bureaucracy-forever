import { cn } from '@/lib/cn';
import { isUnderRaidLevel, levelText } from '@/lib/roster-level';

/** "Level 52" (warning colour under 60) or "Level unknown", kept on one line. */
export function LevelText({ level }: { level: number | null }) {
  return <span className={cn('whitespace-nowrap', isUnderRaidLevel(level) && 'text-warn')}>{levelText(level)}</span>;
}
