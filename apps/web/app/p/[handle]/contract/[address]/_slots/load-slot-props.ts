import { normalizeNetwork } from '@signet/types';
import { attributeContract } from '@/lib/contract-attribution';
import { loadOverviewSpec, loadWasmVersions } from '@/lib/server/contract-overview-source';
import type { VersionSpecItem } from '@/lib/contract-changelog';
import type { ContractSlotProps } from './slot-props';

/**
 * Props for a tab slot, or `null` when the contract is not attributed (the
 * layout has already 404'd or rendered its own unavailable state). The spec
 * lookup is request-cached, so the tabs and the Overview share it.
 */
export async function loadSlotProps(
  handle: string,
  address: string,
): Promise<ContractSlotProps | null> {
  const attribution = await attributeContract(handle, address);
  if (attribution.status !== 'attributed') return null;
  const network = normalizeNetwork(attribution.contract.network);
  const wasmHash = attribution.contract.wasmHash;
  const [spec, wasmVersions] = await Promise.all([
    loadOverviewSpec({ address, network, wasmHash }),
    loadWasmVersions(address, network),
  ]);

  let versionSpecs: VersionSpecItem[] | undefined;
  if (wasmVersions.length > 1) {
    versionSpecs = await Promise.all(
      wasmVersions.map(async (v, i) => {
        if (i === 0 && spec.kind === 'spec') {
          return {
            wasmHash: v.wasmHash,
            observedAt: v.observedAt,
            spec: spec.spec,
          };
        }
        const loaded = await loadOverviewSpec({
          address,
          network,
          wasmHash: v.wasmHash,
        });
        if (loaded.kind === 'spec') {
          return {
            wasmHash: v.wasmHash,
            observedAt: v.observedAt,
            spec: loaded.spec,
          };
        }
        return {
          wasmHash: v.wasmHash,
          observedAt: v.observedAt,
          unretrievable: true,
        };
      }),
    );
  }

  return { handle, address, network, wasmHash, spec, wasmVersions, versionSpecs };
}
