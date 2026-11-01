"use client";

import type { ReactElement, ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  COMPETITION_LEVELS,
  type CompetitionLevel,
} from "../domain/competition";
import { MIN_EARNINGS_OPTIONS, TAG_LABEL, type TagOption } from "../filters";

const ALL = "todas";
const CENTS_PER_REAL = 100;

const COMPETITION_CHIP_LABEL: Record<CompetitionLevel, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export function Chip(props: {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
}): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={props.isActive}
      onClick={props.onClick}
      className={cn(
        "h-9 rounded-lg border px-3 text-sm whitespace-nowrap transition-colors",
        props.isActive
          ? "border-transparent bg-accent font-medium text-accent-foreground"
          : "border-input hover:bg-muted",
      )}
    >
      {props.children}
    </button>
  );
}

export function CompetitionChips(props: {
  value: CompetitionLevel | null;
  onChange: (value: CompetitionLevel | null) => void;
}): ReactElement {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">Concorrência</legend>
      {COMPETITION_LEVELS.map((level) => (
        <Chip
          key={level}
          isActive={props.value === level}
          onClick={() => props.onChange(props.value === level ? null : level)}
        >
          {`Concorrência ${COMPETITION_CHIP_LABEL[level].toLowerCase()}`}
        </Chip>
      ))}
    </fieldset>
  );
}

export function TagChips(props: {
  options: readonly TagOption[];
  value: readonly TagOption[];
  onChange: (value: TagOption[]) => void;
}): ReactElement {
  function toggle(tag: TagOption): void {
    const isOn = props.value.includes(tag);

    props.onChange(
      isOn ? props.value.filter((item) => item !== tag) : [...props.value, tag],
    );
  }

  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">Etiquetas e datas</legend>
      {props.options.map((tag) => (
        <Chip
          key={tag}
          isActive={props.value.includes(tag)}
          onClick={() => toggle(tag)}
        >
          {TAG_LABEL[tag]}
        </Chip>
      ))}
    </fieldset>
  );
}

export function CategorySelect(props: {
  categories: readonly { slug: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
}): ReactElement {
  const items = [
    { value: ALL, label: "Todas as categorias" },
    ...props.categories.map((category) => ({
      value: category.slug,
      label: category.label,
    })),
  ];

  return (
    <Select
      items={items}
      value={props.value ?? ALL}
      onValueChange={(value) => props.onChange(value === ALL ? null : value)}
    >
      <SelectTrigger aria-label="Categoria" className="h-9 min-w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Only one of the offered amounts becomes a filter; anything else means "any". */
function toMinEarningsCents(value: string | null): number | null {
  const reais = MIN_EARNINGS_OPTIONS.find((option) => String(option) === value);

  return reais == null ? null : reais * CENTS_PER_REAL;
}

export function MinEarningsSelect(props: {
  valueCents: number | null;
  onChange: (valueCents: number | null) => void;
}): ReactElement {
  const items = [
    { value: ALL, label: "Qualquer ganho" },
    ...MIN_EARNINGS_OPTIONS.map((reais) => ({
      value: String(reais),
      label: `Ganho a partir de R$ ${reais}`,
    })),
  ];
  const current =
    props.valueCents == null ? ALL : String(props.valueCents / CENTS_PER_REAL);

  return (
    <Select
      items={items}
      value={current}
      onValueChange={(value) => props.onChange(toMinEarningsCents(value))}
    >
      <SelectTrigger
        aria-label="Ganho mínimo por venda"
        className="h-9 min-w-44"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
