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
            className="z-[100] rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
          >
            {content}
            <Tooltip.Arrow className="fill-gray-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
