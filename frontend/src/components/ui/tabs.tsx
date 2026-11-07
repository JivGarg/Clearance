"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/** Category tabs (designPRD 2.4 Knowledge Base). WAI-ARIA tabs: arrows, Home and End. */
export function Tabs({ tabs, initialTabId }: { tabs: TabItem[]; initialTabId?: string }) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(initialTabId ?? tabs[0]?.id);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusTab(index: number) {
    const next = tabs[(index + tabs.length) % tabs.length];
    setActiveId(next.id);
    tabRefs.current[next.id]?.focus();
  }

  function onKeyDown(e: KeyboardEvent, index: number) {
    if (e.key === "ArrowRight") focusTab(index + 1);
    else if (e.key === "ArrowLeft") focusTab(index - 1);
    else if (e.key === "Home") focusTab(0);
    else if (e.key === "End") focusTab(tabs.length - 1);
    else return;
    e.preventDefault();
  }

  return (
    <div>
      <div role="tablist" className="glass inline-flex max-w-full flex-wrap gap-1 rounded-full p-1">
        {tabs.map((tab, i) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[tab.id] = el;
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "min-h-9 rounded-full px-4 text-[14px] font-medium transition-colors",
                active ? "bg-accent text-white" : "text-text-muted hover:bg-surface hover:text-text",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          tabIndex={0}
          className="mt-6"
        >
          {tab.id === activeId ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
