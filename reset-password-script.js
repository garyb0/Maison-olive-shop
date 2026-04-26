let prisma = null;

async function run() {
  try {
    const [{ default: bcrypt }, { PrismaClient }] = await Promise.all([
      import('bcryptjs'),
      import('@prisma/client'),
    ]);

    prisma = new PrismaClient();

    const NEW_PASSWORD = 'test1234';
    const USER_EMAIL = 'gary_b0@hotmail.fr';

    const hash = await bcrypt.hash(NEW_PASSWORD, 12);
    console.log('Hash généré:', hash);

    // Utilisation d'une transaction comme dans auth.ts officiel
    const result = await prisma.$transaction(async (tx) => {
      
      // 1. Mettre à jour le mot de passe
      const user = await tx.user.update({
        where: { email: USER_EMAIL.toLowerCase() },
        data: { passwordHash: hash }
      });

      // 2. ❗ SUPPRIMER TOUTES LES SESSIONS ACTIVES (LE PROBLÈME ÉTAIT ICI)
      await tx.session.deleteMany({
        where: { userId: user.id }
      });

      // 3. Supprimer tous les tokens de reset existants
      await tx.passwordReset.deleteMany({
        where: { userId: user.id }
      });

      return user;
    });

    console.log('\n✅ ✅ RÉINITIALISATION RÉUSSIE !');
    console.log('ID Utilisateur:', result.id);
    console.log('Email:', result.email);
    console.log('Nouveau mot de passe:', NEW_PASSWORD);
    console.log('\nℹ️ Toutes les anciennes sessions ont été supprimées.');
    console.log('ℹ️ Tu dois te reconnecter maintenant.');

  } catch (e) {
    console.error('\n❌ ERREUR:');
    console.error(e.message);
    if (e.code === 'P2025') {
      console.error('\n💡 Aide: Aucun utilisateur trouvé avec cet email');
    }
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

run();
