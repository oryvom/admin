"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { searchPages, type SearchablePage } from "@/lib/search/page-search";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PageSearch({ pages }: { pages: SearchablePage[] }) {
  const router = useRouter();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = searchPages(query, pages);
  const showSuggestions = open && query.trim().length >= 3;

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  function openPage(href: string) {
    setQuery("");
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (results.length === 0 ? 0 : (index + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (results.length === 0 ? 0 : (index - 1 + results.length) % results.length));
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      openPage(results[activeIndex].href);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showSuggestions && results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        placeholder="Search pages"
        value={query}
        className="pl-9"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showSuggestions ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matching pages</li>
          ) : (
            results.map((page, index) => (
              <li key={page.href} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-sm px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground",
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    openPage(page.href);
                  }}
                >
                  {page.title}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
