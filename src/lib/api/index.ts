/**
 * The single entry point to the recruitment backend.
 *
 * Import a namespace — `import { jobs } from "@/lib/api"` — rather than
 * reaching for axios. Everything here is modelled on the Postman collection
 * "Careers Web API — Үндсэн"; `README.md` maps each module to its requests.
 *
 *   auth          sign-up / sign-in (one endpoint) and refresh
 *   account       phone, email and password changes
 *   profile       core record, photo, CV, completion percentages
 *   sections      the CV sections, over three bundle endpoints
 *   reference     every dropdown
 *   jobs          open postings, detail, filter data
 *   applications  applying, tracking, interested roles
 *   system        CMS endpoints from the endpoint reference (not in the collection)
 */

export * as auth from "./auth";
export * as account from "./account";
export * as profile from "./profile";
export * as sections from "./sections";
export * as reference from "./reference";
export * as jobs from "./jobs";
export * as applications from "./applications";
export * as system from "./system";

export { http } from "./core/client";
export { API_BASE_URL, hasLiveBackend, resolveBaseUrl } from "./core/config";
export {
  ApiError,
  type ApiErrorShape,
  isBackendUnavailable,
  isUnauthorized,
  toApiError,
} from "./core/errors";
export {
  type DropdownOption,
  type DropdownQuery,
  type DropdownRow,
  type SectionEntry,
  type SectionResource,
} from "./core/factories";
export {
  type Audience,
  type TokenPair,
  clearSession,
  isSignedIn,
  onSessionChange,
  readAccessToken,
} from "./core/tokens";
