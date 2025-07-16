import type { Label as LabelType } from '@/types';
import { useActiveConnection } from '@/hooks/use-connections';
import { RecursiveFolder } from './recursive-folder';
import { useStats } from '@/hooks/use-stats';
import { Tree } from '../magicui/file-tree';
import { ScrollArea } from './scroll-area';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  data: LabelType[];
};

const SidebarLabels = ({ data }: Props) => {
  const { data: stats } = useStats();
  const { data: activeAccount } = useActiveConnection();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollShadow, setShowScrollShadow] = useState(false);

  const getLabelCount = useCallback(
    (labelName: string | undefined): number => {
      if (!stats || !labelName) return 0;
      return (
        stats.find((stat) => stat.label?.toLowerCase() === labelName.toLowerCase())?.count ?? 0
      );
    },
    [stats],
  );

  // Handle scroll shadow visibility
  useEffect(() => {
    const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    
    if (!scrollElement) return;

    const updateShadow = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const canScroll = scrollHeight > clientHeight;
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 5;
      
      setShowScrollShadow(canScroll && !isAtBottom);
    };

    updateShadow();
    scrollElement.addEventListener('scroll', updateShadow, { passive: true });
    
    // Watch for content changes
    const observer = new ResizeObserver(updateShadow);
    observer.observe(scrollElement);
    
    return () => {
      scrollElement.removeEventListener('scroll', updateShadow);
      observer.disconnect();
    };
  }, [data]);

  return (
    <div className="relative flex-1">
      <ScrollArea ref={scrollAreaRef} className="h-full">
        <div className="relative -m-2 bg-transparent">
          <Tree className="rounded-md bg-transparent">
            {(() => {
              if (!data) return null;
              const isMicrosoftAccount = activeAccount?.providerId === 'microsoft';
              if (isMicrosoftAccount) {
                return data?.map((label) => (
                  <RecursiveFolder
                    key={label.id}
                    label={label}
                    activeAccount={activeAccount}
                    count={getLabelCount(label.name)}
                  />
                ));
              }

              const groups = {
                brackets: [] as typeof data,
                other: [] as typeof data,
                folders: {} as Record<string, typeof data>,
              };

              const folderNames = new Set<string>();
              data.forEach((label) => {
                if (/[^/]+\/[^/]+/.test(label.name)) {
                  const [folderName] = label.name.split('/') as [string];
                  folderNames.add(folderName);
                }
              });

              data.forEach((label) => {
                if (folderNames.has(label.name)) {
                  return;
                }

                if (/\[.*\]/.test(label.name)) {
                  groups.brackets.push(label);
                } else if (/[^/]+\/[^/]+/.test(label.name)) {
                  const [groupName] = label.name.split('/') as [string];
                  if (!groups.folders[groupName]) {
                    groups.folders[groupName] = [];
                  }
                  groups.folders[groupName].push(label);
                } else {
                  groups.other.push(label);
                }
              });

              const components = [];

              Object.entries(groups.folders)
                .sort(([a], [b]) => a.localeCompare(b))
                .forEach(([groupName, labels]) => {
                  const folderLabel = data.find((label) => label.name === groupName);

                  const groupFolder = {
                    id: folderLabel?.id || `group-${groupName}`,
                    name: groupName,
                    type: folderLabel?.type || 'folder',
                    color: folderLabel?.color,
                    labels: labels.map((label) => ({
                      id: label.id,
                      name: label.name.split('/').slice(1).join('/'),
                      type: label.type,
                      color: label.color,
                      originalLabel: label,
                    })),
                  };
                  components.push(
                    <RecursiveFolder
                      key={groupFolder.id}
                      label={groupFolder}
                      activeAccount={activeAccount}
                      count={getLabelCount(groupFolder.name)}
                    />
                  );
                });

              if (groups.other.length > 0) {
                groups.other.forEach((label) => {
                  components.push(
                    <RecursiveFolder
                      key={label.id}
                      label={{
                        id: label.id,
                        name: label.name,
                        type: label.type,
                        color: label.color,
                        originalLabel: label,
                      }}
                      count={getLabelCount(label.name)}
                      activeAccount={activeAccount}
                    />,
                  );
                });
              }

              if (groups.brackets.length > 0) {
                const bracketsFolder = {
                  id: 'group-other',
                  name: 'Other',
                  type: 'folder',
                  labels: groups.brackets.map((label) => ({
                    id: label.id,
                    name: label.name.replace(/\[|\]/g, ''),
                    type: label.type,
                    color: label.color,
                    originalLabel: label,
                  })),
                };
                components.push(
                  <RecursiveFolder
                    key={bracketsFolder.id}
                    label={bracketsFolder}
                    activeAccount={activeAccount}
                    count={
                      stats
                        ? stats.find(
                            (stat) =>
                              stat.label?.toLowerCase() === bracketsFolder.name?.toLowerCase(),
                          )?.count
                        : 0
                    }
                  />,
                );
              }

              return components;
            })()}
          </Tree>
        </div>
      </ScrollArea>
      
      {/* Subtle scroll indicator */}
      {showScrollShadow && (
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 h-8 pointer-events-none",
            "bg-gradient-to-t from-sidebar via-sidebar/40 to-transparent",
            "transition-opacity duration-200"
          )}
        />
      )}
    </div>
  );
};

export default SidebarLabels;
