export function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    const user = req.session?.user;

    if (!user) {
      return res.status(401).json({ error: "Du måste vara inloggad" });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Otillåten åtkomst" });
    }

    next();
  };
}
