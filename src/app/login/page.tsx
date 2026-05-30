import { isGoogleOAuthConfigured, sanitizeGoogleOAuthReturnTo } from "@/lib/google-oauth";
import LoginClient from "./login-client";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = searchParams ? await searchParams : {};
  const returnTo = sanitizeGoogleOAuthReturnTo(getSearchParam(query.returnTo));
  const googleError = getSearchParam(query.google);

  return (
    <LoginClient
      googleOAuthEnabled={isGoogleOAuthConfigured()}
      googleReturnTo={returnTo}
      initialGoogleError={googleError}
    />
  );
}
