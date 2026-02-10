import type { ConnectorMapping } from "@shared/schema";

export interface TransformResult {
  payload: Record<string, unknown>;
  unmappedFields: string[];
  errors: string[];
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    const rec = current as Record<string, unknown>;
    if (part.includes("[")) {
      const match = part.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        const arr = rec[match[1]];
        if (Array.isArray(arr)) {
          current = arr[parseInt(match[2], 10)];
        } else {
          return undefined;
        }
      } else {
        return undefined;
      }
    } else {
      current = rec[part];
    }
  }
  return current;
}

function applyTransformOp(
  value: unknown,
  transform: Record<string, unknown>,
  rawRecord?: Record<string, unknown>
): unknown {
  const op = transform.op as string;

  switch (op) {
    case "cast_string":
      return value != null ? String(value) : null;

    case "cast_number":
    case "cast_int": {
      if (value == null) return null;
      const n = Number(value);
      return isNaN(n) ? null : op === "cast_int" ? Math.floor(n) : n;
    }

    case "cast_boolean":
      if (value == null) return null;
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        return ["true", "1", "yes", "sim"].includes(value.toLowerCase());
      }
      return Boolean(value);

    case "date_parse": {
      if (value == null) return null;
      const format = transform.format as string | undefined;
      if (format === "epoch_ms" && typeof value === "number") {
        return new Date(value).toISOString();
      }
      if (format === "epoch_s" && typeof value === "number") {
        return new Date(value * 1000).toISOString();
      }
      const d = new Date(String(value));
      return isNaN(d.getTime()) ? null : d.toISOString();
    }

    case "lowercase":
      return typeof value === "string" ? value.toLowerCase() : value;

    case "uppercase":
      return typeof value === "string" ? value.toUpperCase() : value;

    case "trim":
      return typeof value === "string" ? value.trim() : value;

    case "default_value":
      return value != null ? value : transform.default;

    case "concat": {
      const separator = (transform.separator as string) ?? "";
      const fields = transform.fields as string[];
      if (!fields || !rawRecord) return value;
      return fields
        .map((f) => {
          const v = getNestedValue(rawRecord, f);
          return v != null ? String(v) : "";
        })
        .join(separator);
    }

    case "map_values": {
      const mapping = transform.mapping as Record<string, unknown>;
      if (!mapping || value == null) return value;
      const key = String(value);
      return key in mapping ? mapping[key] : (transform.default ?? value);
    }

    case "regex_extract": {
      const pattern = transform.pattern as string;
      const group = (transform.group as number) ?? 0;
      if (!pattern || typeof value !== "string") return value;
      try {
        const match = value.match(new RegExp(pattern));
        return match ? (match[group] ?? null) : null;
      } catch {
        return null;
      }
    }

    case "split": {
      const delimiter = (transform.delimiter as string) ?? ",";
      const index = transform.index as number | undefined;
      if (typeof value !== "string") return value;
      const parts = value.split(delimiter);
      return index != null ? (parts[index] ?? null) : parts;
    }

    case "template": {
      const tmpl = transform.template as string;
      if (!tmpl) return value;
      return tmpl.replace(/\{\{value\}\}/g, String(value ?? ""));
    }

    default:
      return value;
  }
}

export function applyMappings(
  rawRecord: Record<string, unknown>,
  mappings: ConnectorMapping[]
): TransformResult {
  const payload: Record<string, unknown> = {};
  const unmappedFields: string[] = [];
  const errors: string[] = [];

  const mappedSourcePaths = new Set(mappings.map((m) => m.sourcePath));

  for (const mapping of mappings) {
    try {
      let value = getNestedValue(rawRecord, mapping.sourcePath);

      if (mapping.transform && typeof mapping.transform === "object") {
        const transforms = Array.isArray(mapping.transform)
          ? mapping.transform
          : [mapping.transform];

        for (const t of transforms) {
          value = applyTransformOp(value, t as Record<string, unknown>, rawRecord);
        }
      }

      payload[mapping.targetField] = value;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(
        `Transform error for ${mapping.sourcePath} -> ${mapping.targetField}: ${msg}`
      );
    }
  }

  const topLevelKeys = Object.keys(rawRecord);
  for (const key of topLevelKeys) {
    if (!mappedSourcePaths.has(key)) {
      unmappedFields.push(key);
    }
  }

  return { payload, unmappedFields, errors };
}

export function extractSourceId(
  rawRecord: Record<string, unknown>,
  idField: string = "id"
): string | null {
  const value = getNestedValue(rawRecord, idField);
  return value != null ? String(value) : null;
}
