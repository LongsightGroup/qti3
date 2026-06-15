import { diagnostic, isCapabilitySupported, isExtensionSupport, stringParam } from "./helpers.js";
import { conflictingSupportNames } from "./conflicts.js";
import { getQti3PnpSupportDefinition } from "./registry.js";
import type { Qti3PnpSupportRegistryEntry } from "./registry.js";
import type {
  NormalizedQti3PnpProfile,
  Qti3PnpCatalogSupportRequest,
  Qti3PnpPreference,
  Qti3PnpResolution,
  Qti3PnpResolveContext,
  Qti3PnpUnresolvedPreference,
  QtiCatalogSupportSummary,
} from "./types.js";

type SupportResolutionOutcome = "resolved" | "unsupported" | "unresolved";

export function resolveQti3Pnp(
  profile: NormalizedQti3PnpProfile,
  context: Qti3PnpResolveContext,
): Qti3PnpResolution {
  const resolution: Qti3PnpResolution = {
    display: {},
    tools: {},
    media: {},
    session: {},
    catalogRequests: [],
    prohibited: [],
    extensions: [],
    unresolved: [],
    diagnostics: [...profile.diagnostics],
  };
  const conflictSupports = conflictingSupportNames(profile.preferences);

  for (const preference of profile.preferences) {
    if (preference.mode === "prohibited") {
      resolution.prohibited.push(preference.support);
      getQti3PnpSupportDefinition(preference.support)?.prohibit?.(resolution);
      continue;
    }

    const support = preference.support.toLowerCase();
    if (conflictSupports.has(support)) {
      if (context.policy?.onConflict === "prohibit-wins") continue;
      unresolved(resolution, preference, "conflict");
      continue;
    }

    if (isPolicyBlocked(preference, context)) {
      resolution.diagnostics.push(
        diagnostic(
          "PNP_BLOCKED_BY_POLICY",
          "warning",
          preference,
          "PNP support was blocked by host policy.",
        ),
      );
      unresolved(resolution, preference, "policy-blocked");
      continue;
    }

    if (isExtensionSupport(preference.support)) {
      resolveExtension(preference, context, resolution);
      continue;
    }

    const definition = getQti3PnpSupportDefinition(preference.support);
    if (!definition) {
      handleUnsupported(preference, context, resolution);
      continue;
    }

    if (resolveKnownSupport(definition, preference, context, resolution) === "unsupported") {
      handleUnsupported(preference, context, resolution);
    }
  }

  return resolution;
}

function resolveKnownSupport(
  definition: Qti3PnpSupportRegistryEntry,
  preference: Qti3PnpPreference,
  context: Qti3PnpResolveContext,
  resolution: Qti3PnpResolution,
): SupportResolutionOutcome {
  let resolved = false;

  if (definition.apply) {
    if (!isCapabilitySupported(preference, context.capabilities, definition)) {
      return definition.allowedAsCatalogSupport
        ? resolveCatalogOnly(preference, context, resolution)
        : "unsupported";
    }
    definition.apply(resolution, preference);
    resolved = true;
  }

  if (definition.allowedAsCatalogSupport) {
    const catalogOutcome = resolveCatalogOnly(preference, context, resolution);
    if (catalogOutcome === "resolved") resolved = true;
    else if (!definition.apply) return catalogOutcome;
  }

  return resolved ? "resolved" : "unsupported";
}

function resolveCatalogOnly(
  preference: Qti3PnpPreference,
  context: Qti3PnpResolveContext,
  resolution: Qti3PnpResolution,
): SupportResolutionOutcome {
  return tryResolveCatalogSupport(preference, context, resolution) ? "resolved" : "unresolved";
}

function tryResolveCatalogSupport(
  preference: Qti3PnpPreference,
  context: Qti3PnpResolveContext,
  resolution: Qti3PnpResolution,
): boolean {
  const matches = catalogSupports(context).filter(
    (support) => support.support.toLowerCase() === preference.support.toLowerCase(),
  );
  if (matches.length === 0) {
    resolution.diagnostics.push(
      diagnostic(
        "PNP_CATALOG_SUPPORT_MISSING",
        "warning",
        preference,
        "Requested QTI catalog support is missing.",
      ),
    );
    unresolved(resolution, preference, "content-missing");
    return false;
  }
  const language = stringParam(preference.params, "language") ?? context.activity?.language;
  const match = chooseLanguageMatch(matches, language);
  if (!match) {
    resolution.diagnostics.push(
      diagnostic(
        "PNP_CATALOG_LANGUAGE_MISSING",
        "warning",
        preference,
        "Requested QTI catalog support language is missing.",
      ),
    );
    unresolved(resolution, preference, "content-missing");
    return false;
  }
  resolution.catalogRequests.push(catalogRequest(preference, match));
  return true;
}

function catalogRequest(
  preference: Qti3PnpPreference,
  match: QtiCatalogSupportSummary,
): Qti3PnpCatalogSupportRequest {
  const request: Qti3PnpCatalogSupportRequest = {
    support: preference.support,
    catalogId: match.catalogId,
    reason: preference.mode === "activate-at-initialization" ? "pnp-initial" : "pnp-required",
  };
  if (match.language) request.entryLanguage = match.language;
  return request;
}

function catalogSupports(context: Qti3PnpResolveContext): QtiCatalogSupportSummary[] {
  return [
    ...(context.qti?.catalogSupports ?? []),
    ...(context.qti?.catalogResolution?.references.flatMap((reference) => [...reference.matches]) ??
      []),
  ];
}

function chooseLanguageMatch(
  matches: QtiCatalogSupportSummary[],
  language: string | undefined,
): QtiCatalogSupportSummary | undefined {
  if (!language) return matches.find((match) => match.default) ?? matches[0];
  const normalized = language.toLowerCase();
  const primary = normalized.split("-")[0] ?? normalized;
  return (
    matches.find((match) => match.language?.toLowerCase() === normalized) ??
    matches.find((match) => match.language?.toLowerCase().split("-")[0] === primary) ??
    matches.find((match) => match.default)
  );
}

function handleUnsupported(
  preference: Qti3PnpPreference,
  context: Qti3PnpResolveContext,
  resolution: Qti3PnpResolution,
): void {
  const action = context.policy?.onUnsupportedSupport ?? "diagnostic";
  if (action === "ignore") return;
  resolution.diagnostics.push(
    diagnostic(
      "PNP_UNSUPPORTED_BY_PLAYER",
      action === "error" ? "error" : "warning",
      preference,
      "PNP support is not supported by the current capabilities.",
    ),
  );
  unresolved(resolution, preference, "unsupported");
}

function resolveExtension(
  preference: Qti3PnpPreference,
  context: Qti3PnpResolveContext,
  resolution: Qti3PnpResolution,
): void {
  const action = context.policy?.onCustomSupport ?? "preserve";
  if (action === "ignore") return;
  if (action === "diagnostic" || action === "error") {
    resolution.diagnostics.push(
      diagnostic(
        "PNP_UNSUPPORTED_EXTENSION",
        action === "error" ? "error" : "warning",
        preference,
        "Custom PNP support is not interpreted by the default resolver.",
      ),
    );
    unresolved(resolution, preference, "unsupported");
    return;
  }
  resolution.extensions.push(preference);
}

function isPolicyBlocked(preference: Qti3PnpPreference, context: Qti3PnpResolveContext): boolean {
  const decision = context.policy?.isSupportAllowed?.(preference, context);
  if (typeof decision === "boolean") return !decision;
  if (decision) return !decision.allowed;
  return false;
}

function unresolved(
  resolution: Qti3PnpResolution,
  preference: Qti3PnpPreference,
  reason: Qti3PnpUnresolvedPreference["reason"],
): void {
  resolution.unresolved.push({ preference, reason });
}
