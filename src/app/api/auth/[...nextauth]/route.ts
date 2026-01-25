import NextAuth, { NextAuthOptions, Session, User, Account } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";

export const authOptions: NextAuthOptions = {
    providers: [
        GithubProvider({
            clientId: process.env.GITHUB_ID || "mock_client_id",
            clientSecret: process.env.GITHUB_SECRET || "mock_client_secret",
            authorization: {
                params: {
                    scope: "repo read:user user:email"
                }
            }
        }),
        CredentialsProvider({
            id: "local-guest",
            name: "Guest (Local Storage)",
            credentials: {},
            async authorize() {
                return {
                    id: "guest",
                    name: "Guest User",
                    email: "guest@local",
                    image: `https://ui-avatars.com/api/?name=Guest+User&background=random`,
                    accessToken: "mock_access_token"
                } as User & { accessToken: string };
            }
        })
    ],
    callbacks: {
        async jwt({ token, account }: { token: JWT; account?: Account | null }) {
            // Persist the OAuth access_token to the token right after signin
            if (account) {
                token.accessToken = account.access_token;
            }
            return token;
        },
        async session({ session, token }: { session: Session; token: JWT }) {
            // Send properties to the client, like an access_token from a provider.
            session.accessToken = token.accessToken;
            return session;
        }
    },
    secret: "temporary_secret_for_local_testing_build"
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };