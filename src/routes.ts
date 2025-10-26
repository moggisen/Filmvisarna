export const routePath = {
  home: "/",
  biljett: "/booking",
  login: "/login",
  signup: "/signup",
  profile: "/profile",
  confirm: "/confirm",
  "movie-detail": "/movies/:id",
};

export type RouteKey = keyof typeof routePath;

/** Bygg en länk från routePath och ersätt param:er, t.ex. :id */
export function buildPath<K extends RouteKey>(
  key: K,
  params?: Record<string, string | number>
) {
  let p = routePath[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      p = p.replace(`:${k}`, String(v));
    }
  }
  return p;
}
