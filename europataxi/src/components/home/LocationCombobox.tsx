"use client";

import { Check, MapPin, Plane, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { FieldShell, controlClasses, describedBy } from "@/components/ui";
import type { Dictionary } from "@/i18n/getDictionary";
import type { CountryCode, Location } from "@/types";

export interface LocationComboboxProps {
  id: string;
  label: string;
  /** Seçili konumun kimliği; boş dize = seçim yok. */
  value: string;
  onChange: (id: string) => void;
  locations: Location[];
  dict: Pick<Dictionary, "widget" | "countries" | "locations" | "locationTypes">;
  /** Diğer alanın seçimi; listede pasif gösterilir, seçilemez. */
  exclude?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  className?: string;
}

interface Entry {
  location: Location;
  name: string;
  disabled: boolean;
}

interface Group {
  country: CountryCode;
  entries: Entry[];
}

/**
 * Türkçeye duyarlı, aksan bağımsız arama anahtarı: "Brüksel" → "bruksel",
 * "İstanbul" → "istanbul". Türkçe yazımda "x" "ks" olur (Bruxelles → Brüksel);
 * böylece "brux" ve "bruksel" aynı sonucu bulur.
 */
export function normalizeSearch(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/x/g, "ks")
    .trim();
}

function locationName(dict: LocationComboboxProps["dict"], location: Location): string {
  const names: Record<string, string | undefined> = dict.locations;
  return names[location.id] ?? location.id;
}

/** Listede IATA kodu ayrı rozet olarak gösterildiği için addaki "(BRU)" ekini kaldırır. */
function shortName(name: string, iata?: string): string {
  if (!iata) return name;
  const suffix = ` (${iata})`;
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

/** Ad, IATA kodu ve konum kimliği ("the-hague" → "the hague") üzerinden eşleşir. */
function matches(entryName: string, location: Location, query: string): boolean {
  if (!query) return true;
  if (normalizeSearch(entryName).includes(query)) return true;
  if (location.iata && normalizeSearch(location.iata).includes(query)) return true;
  return normalizeSearch(location.id.replace(/-/g, " ")).includes(query);
}

/** Aramaya uyan konumları, veri sırasını koruyarak ülkeye göre gruplar. */
function buildGroups(locations: Location[], dict: LocationComboboxProps["dict"], query: string, exclude?: string): Group[] {
  const q = normalizeSearch(query);
  const groups: Group[] = [];
  for (const location of locations) {
    const name = locationName(dict, location);
    if (!matches(name, location, q)) continue;
    const entry: Entry = { location, name, disabled: Boolean(exclude) && location.id === exclude };
    const group = groups.find((g) => g.country === location.country);
    if (group) group.entries.push(entry);
    else groups.push({ country: location.country, entries: [entry] });
  }
  return groups;
}

function firstEnabled(entries: Entry[]): number {
  return entries.findIndex((e) => !e.disabled);
}

function lastEnabled(entries: Entry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) if (!entries[i]?.disabled) return i;
  return -1;
}

/**
 * Aranabilir konum seçici (WAI-ARIA combobox + listbox). Ok tuşları seçeneği gezer,
 * Enter seçer, Escape ve Tab kapatır. Değer konum kimliğidir; alanda adı görünür.
 */
export function LocationCombobox({
  id,
  label,
  value,
  onChange,
  locations,
  dict,
  exclude,
  error,
  hint,
  placeholder,
  className,
}: LocationComboboxProps) {
  /** null = yazılmıyor, alan seçili konumun adını gösterir. */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const listboxId = `${id}-listbox`;
  const optionId = (locationId: string) => `${id}-opt-${locationId}`;

  const selected = locations.find((l) => l.id === value);
  const text = query ?? (selected ? locationName(dict, selected) : "");

  const groups = useMemo(() => buildGroups(locations, dict, query ?? "", exclude), [locations, dict, query, exclude]);
  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  const indexById = useMemo(() => new Map(flat.map((entry, index) => [entry.location.id, index])), [flat]);
  const activeEntry = open && activeIndex >= 0 ? flat[activeIndex] : undefined;
  const activeId = activeEntry ? optionId(activeEntry.location.id) : undefined;

  // Aktif seçeneği kaydırılabilir listede görünür tut.
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function close() {
    setOpen(false);
    setQuery(null);
    setActiveIndex(-1);
  }

  function openList(preferLast = false) {
    const current = flat.findIndex((e) => e.location.id === value && !e.disabled);
    setActiveIndex(current >= 0 ? current : preferLast ? lastEnabled(flat) : firstEnabled(flat));
    setOpen(true);
  }

  function select(entry: Entry) {
    if (entry.disabled) return;
    onChange(entry.location.id);
    close();
  }

  function clear() {
    onChange("");
    close();
    inputRef.current?.focus();
  }

  /** Pasif seçenekleri atlayarak aktif seçeneği ileri/geri taşır (uçlarda döner). */
  function step(delta: 1 | -1) {
    if (!open) {
      openList(delta < 0);
      return;
    }
    const n = flat.length;
    if (!n) return;
    let i = activeIndex < 0 ? (delta > 0 ? -1 : n) : activeIndex;
    for (let k = 0; k < n; k++) {
      i = (i + delta + n) % n;
      const entry = flat[i];
      if (entry && !entry.disabled) {
        setActiveIndex(i);
        return;
      }
    }
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setQuery(next);
    if (next === "" && value) onChange("");
    const nextFlat = buildGroups(locations, dict, next, exclude).flatMap((g) => g.entries);
    setActiveIndex(firstEnabled(nextFlat));
    setOpen(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        step(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        step(-1);
        break;
      case "Enter":
        if (!open) return;
        event.preventDefault();
        if (activeEntry) select(activeEntry);
        else close();
        break;
      case "Escape":
        if (!open) return;
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case "Tab":
        if (open) close();
        break;
      default:
    }
  }

  const LeadIcon = selected ? (selected.type === "airport" ? Plane : MapPin) : Search;

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <div className="relative">
        <LeadIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-activedescendant={activeId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          autoComplete="off"
          spellCheck={false}
          value={text}
          placeholder={placeholder}
          onChange={onInput}
          onKeyDown={onKeyDown}
          onClick={() => {
            if (!open) openList();
          }}
          onBlur={close}
          className={`${controlClasses} min-h-12 pl-10 ${value ? "pr-11" : ""}`}
        />
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label={dict.widget.clearSelection}
            className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors motion-reduce:transition-none hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taxi-ink"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}

        {/* mousedown engellenir ki seçeneğe tıklarken alan odağı kaybetmesin. */}
        <div
          onMouseDown={(event) => event.preventDefault()}
          className={`absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-line bg-surface shadow-card ${open ? "" : "hidden"}`}
        >
          {/* Kaydırma ARIA bileşeninin kendisindedir; sarmalayıcıda olsaydı klavyeyle erişilemeyen bir kaydırma alanı oluşurdu. */}
          <ul id={listboxId} role="listbox" aria-label={dict.widget.listboxLabel} tabIndex={-1} className="max-h-72 overflow-auto py-1">
            {open
              ? groups.map((group) => {
                  const groupLabelId = `${id}-group-${group.country}`;
                  return (
                    // `group` rolü <li> için geçerli değildir; iç <ul>'de durur. Başlık grubun
                    // dışındadır, yoksa ülke adı hem grup adı hem de içerik olarak iki kez okunur.
                    <li key={group.country} role="presentation">
                      <div
                        id={groupLabelId}
                        role="presentation"
                        className="flex items-center gap-2 px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted"
                      >
                        <span>{dict.countries[group.country]}</span>
                        <span className="rounded border border-line px-1 tabular-nums">{group.country}</span>
                      </div>
                      <ul role="group" aria-labelledby={groupLabelId}>
                        {group.entries.map((entry) => {
                          const index = indexById.get(entry.location.id) ?? -1;
                          const isActive = index === activeIndex;
                          const isSelected = entry.location.id === value;
                          const Icon = entry.location.type === "airport" ? Plane : MapPin;
                          return (
                            <li
                              key={entry.location.id}
                              id={optionId(entry.location.id)}
                              role="option"
                              aria-selected={isActive}
                              aria-disabled={entry.disabled || undefined}
                              onClick={() => select(entry)}
                              onMouseMove={() => {
                                if (!entry.disabled && index !== activeIndex) setActiveIndex(index);
                              }}
                              className={`flex items-center gap-3 px-3 py-2.5 text-base text-content ${
                                entry.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                              } ${isActive ? "bg-surface-2 ring-2 ring-inset ring-taxi-ink" : ""}`}
                            >
                              <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${isActive ? "text-taxi-ink" : "text-muted"}`} />
                              <span className="min-w-0 flex-1 break-words">{shortName(entry.name, entry.location.iata)}</span>
                              <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-muted">
                                {entry.location.iata ? (
                                  <span className="rounded border border-line px-1.5 font-bold tabular-nums text-content">{entry.location.iata}</span>
                                ) : null}
                                <span>{dict.locationTypes[entry.location.type]}</span>
                              </span>
                              {isSelected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-taxi-ink" /> : null}
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  );
                })
              : null}
          </ul>
          <p role="status" aria-live="polite" className={open && flat.length === 0 ? "px-3 py-3 text-sm text-muted" : "sr-only"}>
            {open && flat.length === 0 ? dict.widget.noResults : null}
          </p>
        </div>
      </div>
    </FieldShell>
  );
}
