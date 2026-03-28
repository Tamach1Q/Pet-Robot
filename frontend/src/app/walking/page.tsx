import { WalkingNavigationClient } from "@/components/walking/WalkingNavigationClient";

type WalkingPageProps = {
  searchParams?: Promise<{
    source?: string | string[];
    routeId?: string | string[];
  }>;
};

function getSingleSearchParam(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function WalkingPage({ searchParams }: WalkingPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const source = getSingleSearchParam(resolvedSearchParams?.source);
  const routeId = getSingleSearchParam(resolvedSearchParams?.routeId);
  const shouldUsePersistedSetupRoute = source === "setup" && !routeId;

  return (
    <WalkingNavigationClient shouldUsePersistedSetupRoute={shouldUsePersistedSetupRoute} />
  );
}
