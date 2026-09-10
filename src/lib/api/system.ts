import { API_BASE_URL, SYSTEM_BASE } from "./core/config";
import { apiGet, apiGetList, apiPost, apiUpload } from "./core/request";

/**
 * NOT IN THE POSTMAN COLLECTION. These come from the older endpoint
 * reference document and are unverified against a live server — treat the
 * shapes here as provisional until someone exercises them.
 *
 * `/api/system` — the CMS behind the marketing surfaces: company profiles,
 * homepage sliders, news, videos and the internship microsite.
 *
 * Reads are public; every write is `Auth: Admin login`, so those calls must
 * carry the admin token (`audience: "admin"`) rather than the applicant one.
 */

const p = (name: string) => `${SYSTEM_BASE}/${name}`;
const asAdmin = { audience: "admin" } as const;
const publicRead = { skipAuth: true } as const;

export type ImageTag = "COMPANY" | "SLIDER" | "RECNEWS" | "RECVIDEO" | "INTERNSHIP";

export type CompanyInfoInput = {
  entryid: number;
  companyid: string;
  companyname: string;
  weburl?: string;
  description?: string;
};

export type SliderInput = {
  entryid: number;
  page: string;
  title: string;
  description?: string;
  isactive: "Y" | "N";
  weburl?: string;
  weburlname?: string;
};

export type NewsInput = {
  entryid: number;
  page: string;
  title: string;
  brieftext?: string;
  description?: string;
  isactive: "Y" | "N";
};

export type VideoInput = SliderInput;

/* --- Company ----------------------------------------------------------- */

export function saveCompanyInfo(body: CompanyInfoInput) {
  return apiPost<unknown>(p("saveCompanyInfo"), body, asAdmin);
}

export function listCompanies<T = unknown>() {
  return apiGetList<T>(p("getCompanyInfoAll"), undefined, publicRead);
}

export function getCompanyInfo<T = unknown>(query: { entryID?: number; companyID?: string }) {
  return apiGet<T>(p("getCompanyInfo"), query, publicRead);
}

/* --- Images ------------------------------------------------------------ */

/** POST /api/system/uploadImage?entryID=…&tag=… — Auth: admin. */
export function uploadImage(file: File, query: { entryID: number; tag: ImageTag }) {
  return apiUpload<unknown>(p("uploadImage"), file, { ...asAdmin, params: query });
}

/**
 * `downloadImage/{filePath}` is served directly, so this returns a URL for
 * `<img src>` rather than fetching bytes. Returns null in fixture mode, where
 * there is no origin to build against.
 */
export function imageUrl(filePath: string): string | null {
  if (!API_BASE_URL) return null;
  const clean = filePath.replace(/^\/+/, "");
  return `${API_BASE_URL}${p("downloadImage")}/${clean}`;
}

/* --- Homepage slider --------------------------------------------------- */

export function saveSlider(body: SliderInput) {
  return apiPost<unknown>(p("saveRecruitmentSlider"), body, asAdmin);
}

export function listSliders<T = unknown>(query: { page?: string; isActive?: "Y" | "N" } = {}) {
  return apiGetList<T>(p("getRecruitmentSliderList"), query, publicRead);
}

export function getSlider<T = unknown>(entryID: number) {
  return apiGet<T>(p("getRecruitmentSlider"), { entryID }, publicRead);
}

/* --- Internship microsite ---------------------------------------------- */

export function saveInternshipPage(body: { entryid: number; content: string }) {
  return apiPost<unknown>(p("saveInternshipPage"), body, asAdmin);
}

export function listInternshipPages<T = unknown>() {
  return apiGetList<T>(p("getInternshipPageList"), undefined, publicRead);
}

export function getInternshipPage<T = unknown>(entryID: number) {
  return apiGet<T>(p("getInternshipPage"), { entryID }, publicRead);
}

export function getInternshipImages<T = unknown>(pageID: number) {
  return apiGetList<T>(p("getInternshipImages"), { pageID }, publicRead);
}

export function deleteInternshipImage(body: { entryid: number; [key: string]: unknown }) {
  return apiPost<unknown>(p("deleteInternshipImage"), body, asAdmin);
}

/* --- News -------------------------------------------------------------- */

/** The next free news id, requested before composing an article. */
export function getNextNewsId<T = unknown>() {
  return apiGet<T>(p("getRecNewsId"), undefined, publicRead);
}

export function saveNews(body: NewsInput) {
  return apiPost<unknown>(p("saveRecNews"), body, asAdmin);
}

export function listNews<T = unknown>(query: { isactive?: "Y" | "N" } = {}) {
  return apiGetList<T>(p("getRecNewsList"), query, publicRead);
}

export function getNews<T = unknown>(entryid: number) {
  return apiGet<T>(p("getRecNews"), { entryid }, publicRead);
}

/* --- Video ------------------------------------------------------------- */

export function saveVideo(body: VideoInput) {
  return apiPost<unknown>(p("saveRecVideo"), body, asAdmin);
}

export function listVideos<T = unknown>(query: { isactive?: "Y" | "N" } = {}) {
  return apiGetList<T>(p("getRecVideoList"), query, publicRead);
}

export function getVideo<T = unknown>(entryid: number) {
  return apiGet<T>(p("getRecVideo"), { entryid }, publicRead);
}

/* --- Templates --------------------------------------------------------- */

/** Placeholder/replacement data for generated documents and emails. */
export function getReplaceData<T = unknown>() {
  return apiGet<T>(p("getReplaceData"), undefined, publicRead);
}
