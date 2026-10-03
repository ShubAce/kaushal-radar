import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DistrictView } from "./view";
import {
  cells, districtLayer, flags, geo, isDistrict, isTrade, mapState, meta, overall, projects, sectorRows, series,
} from "@/lib/data";

export async function generateMetadata(props: PageProps<"/district/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: geo().districts.find((d) => d.id === id)?.name ?? "District" };
}

export default async function Page(props: PageProps<"/district/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!isDistrict(id)) notFound();
  const info = geo().districts.find((d) => d.id === id)!;
  const rows = cells({ district: id });
  const want = Array.isArray(sp.trade) ? sp.trade[0] : sp.trade;
  return (
    <DistrictView
      meta={meta()}
      info={info}
      overall={overall({ district: id })}
      sectors={sectorRows({ district: id })}
      cells={rows}
      series={series({ district: id })}
      flags={flags({ district: id })}
      projects={projects({ district: id })}
      map={mapState(info.state)}
      layer={Object.fromEntries(districtLayer(info.state).map((r) => [r.id, r]))}
      initialTrade={isTrade(want) && rows.some((r) => r.trade === want) ? want : null}
    />
  );
}
