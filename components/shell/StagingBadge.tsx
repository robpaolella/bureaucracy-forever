import { StatusPill } from '@/components/ui';
import { isStagingDeployment } from '@/lib/deploy-env';

/**
 * Corner marker so staging is never mistaken for the live site. Renders nothing anywhere
 * else. Pointer events pass through, so it never covers a control.
 */
export function StagingBadge() {
  if (!isStagingDeployment()) return null;
  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-50">
      <StatusPill tone="warn" className="shadow-pop">
        Staging
      </StatusPill>
    </div>
  );
}
