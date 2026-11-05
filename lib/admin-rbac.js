const ADMIN_ROLES = Object.freeze(['superadmin', 'editor', 'support']);

function adminRoleOf(user) {
  if (['admin', 'teacher'].includes(user?.role) && ADMIN_ROLES.includes(user.adminRole)) {
    return user.adminRole;
  }
  return user?.role === 'admin' ? 'superadmin' : null;
}

function yetkiKontrolEt(allowedRoles, User) {
  return async (req, res, next) => {
    const userId = req.session?.user?.id;
    if (!userId) return res.status(401).json({ mesaj: 'Giriş yapmanız gerekiyor.' });

    try {
      const user = await User.findById(userId).select('name email role adminRole');
      if (!user) return res.status(401).json({ mesaj: 'Hesap bulunamadı. Yeniden giriş yapın.' });
      const adminRole = adminRoleOf(user);
      if (!adminRole || !allowedRoles.includes(adminRole)) {
        return res.status(403).json({ mesaj: 'Bu işlem için yetkiniz yok.' });
      }

      req.adminUser = user;
      req.adminRole = adminRole;
      req.session.user = {
        ...req.session.user,
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        adminRole
      };
      next();
    } catch (error) {
      console.error('Yönetici yetkisi doğrulanamadı:', error);
      res.status(500).json({ mesaj: 'Yetki doğrulanamadı.' });
    }
  };
}

module.exports = { ADMIN_ROLES, adminRoleOf, yetkiKontrolEt };
