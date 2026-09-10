/**
 * The single entry point to the recruitment backend.
 *
 * Import the namespace you need — `import { jobs } from "@/lib/api"` — or the
 * grouped `api` object. Components should never reach for axios directly; if
 * a call does not exist here yet, add it to the module it belongs to.
 *
 * Module map (117 documented endpoints):
 *
 *   auth          4   login / refresh, applicant and admin
 *   account       8   registration, OTP, password reset, credential changes
 *   profile       6   core record, photo and CV uploads
 *   sections     ~45  the fifteen CV sections, via `createSection`
 *   reference    20   dropdown lists, via `createDropdown`
 *   jobs          4   public postings and the filter bundle
 *   applications  9   applying, tracking, interests, internship sign-up
 *   system       21   CMS: company, sliders, news, video, internship pages
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
export { API_BASE_URL, hasLiveBackend } from "./core/config";
export { type ApiErrorShape, isBackendUnavailable, toApiError } from "./core/errors";
export { type DropdownOption, type DropdownQuery } from "./core/factories";
export { type SectionEntry, type SectionResource } from "./core/factories";
export {
  type Audience,
  type TokenPair,
  clearSession,
  isSignedIn,
  onSessionChange,
} from "./core/tokens";
