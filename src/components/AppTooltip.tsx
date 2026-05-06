import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

interface AppTooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export default function AppTooltip({ content, children, side = 'right' }: AppTooltipProps) {
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side={side}
            sideOffset={10}
            className="z-[100] rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-bold text-white shadow-lg dark:bg-white dark:text-slate-950"
          >
            {content}
            <Tooltip.Arrow className="fill-slate-950 dark:fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
