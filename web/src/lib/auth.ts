import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    id: 'credentials',
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: '密碼', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password) return null;
      const user = await prisma.user.findUnique({
        where: { email: credentials.email.toLowerCase().trim() },
      });
      if (!user || !user.passwordHash) return null;
      const ok = await bcrypt.compare(credentials.password, user.passwordHash);
      if (!ok) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.displayName || user.name || user.email,
        image: user.avatarUrl || user.image,
        role: user.role,
      } as any;
    },
  }),
];

if (googleEnabled) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    })
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as any).id;
        token.role = (user as any).role ?? 'MEMBER';
      }
      // 每次請求刷新 role / 暱稱，管理員權限改動即時生效
      if (token.uid) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.uid as string },
          select: { role: true, displayName: true, name: true, points: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.name = dbUser.displayName || dbUser.name || token.name;
          token.points = dbUser.points;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.uid;
        (session.user as any).role = token.role;
        (session.user as any).points = token.points;
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}

/** 在 Server Component / API Route 中取得目前會員，未登入回傳 null */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') return null;
  return user;
}
