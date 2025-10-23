export const routePath = {
  home: "/",
  biljett: "/booking",
  login: "/login",
  signup: "/signup",
  profile: "/profile",
  confirm: "/confirm",
  "movie-detail": "/movies", //  /movies/:id senare
};
export type RouteKey = keyof typeof routePath;
