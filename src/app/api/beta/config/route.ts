import { NextResponse } from "next/server";
import { betaFeatureConfig, betaFeatureDetails } from "@/lib/beta-features";

export function GET() {
  return NextResponse.json({
    features: betaFeatureConfig(),
    featureDetails: betaFeatureDetails(),
  });
}
