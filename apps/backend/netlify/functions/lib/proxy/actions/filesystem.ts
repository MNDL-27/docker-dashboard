import { resolveOrganizationEntitlements } from '../../access-controls.mjs';
import { buildRequest, dockerFetch } from '../client';
import { sanitizeContainerId } from '../utils';
import { parseTarDirectory } from '../../tar-directory-parser.mjs';
import { recordProxyAudit } from '../audit';
import type { ProxyContext } from '../types';

export async function handleFsList(
  ctx: ProxyContext,
  containerId: string,
  params: Record<string, any>,
) {
  const { host, secrets, auth, corsHeaders, createProblemResponse } = ctx;

  const entitlements = await resolveOrganizationEntitlements({
    organizationId: host.organization_id,
    isPlatformAdmin: auth.isPlatformAdmin,
  });
  if (!entitlements.canUseFileManager) {
    return createProblemResponse(
      403,
      "File Manager requires a paid subscription",
      "The File Manager requires an Individual, Business, or Dedicated subscription.",
      "feature_not_allowed",
    );
  }

  const fsPath = params?.path || '/';
  if (typeof fsPath !== 'string' || !fsPath.startsWith('/') || fsPath.includes('..')) {
    return createProblemResponse(400, "Invalid path", "Path must be absolute and must not contain '..'");
  }

  const sanitizedId = sanitizeContainerId(containerId);
  const encodedDirPath = encodeURIComponent(fsPath);
  const archiveReq = buildRequest(
    host,
    secrets,
    `/containers/${sanitizedId}/archive?path=${encodedDirPath}`,
    'GET',
  );

  const archiveResp = await dockerFetch(archiveReq.url, archiveReq.method, archiveReq.headers, 10000);

  if (!archiveResp.ok) {
    const detail = await archiveResp.text();
    if (archiveResp.status === 404) {
      return createProblemResponse(404, "Directory not found", `${fsPath} does not exist in this container`);
    }
    if (archiveResp.status === 400) {
      return createProblemResponse(400, "Not a directory", `${fsPath} is not a directory`);
    }
    return createProblemResponse(
      archiveResp.status || 502,
      "Failed to list directory",
      detail,
    );
  }

  const tarBytes = new Uint8Array(await archiveResp.arrayBuffer());

  const MAX_LISTING_TAR = 8 * 1024 * 1024;
  if (tarBytes.length > MAX_LISTING_TAR) {
    return createProblemResponse(
      413,
      "Directory listing too large",
      "This directory contains too many or too large entries to list in a single request.",
    );
  }

  const entries = parseTarDirectory(tarBytes);

  await recordProxyAudit({
    organizationId: host.organization_id,
    actorUserId: auth.userId,
    action: 'container-fs-list',
    hostId: host.id,
    containerId: sanitizedId,
    path: fsPath,
  });

  return new Response(JSON.stringify({ entries, path: fsPath }), { headers: corsHeaders });
}

export async function handleFsRead(
  ctx: ProxyContext,
  containerId: string,
  params: Record<string, any>,
) {
  const { host, secrets, auth, corsHeaders, createProblemResponse } = ctx;

  const entitlements = await resolveOrganizationEntitlements({
    organizationId: host.organization_id,
    isPlatformAdmin: auth.isPlatformAdmin,
  });
  if (!entitlements.canUseFileManager) {
    return createProblemResponse(
      403,
      "File Manager requires a paid subscription",
      "The File Manager requires an Individual, Business, or Dedicated subscription.",
      "feature_not_allowed",
    );
  }

  const readPath = params?.path;
  if (typeof readPath !== 'string' || !readPath.startsWith('/') || readPath.includes('..')) {
    return createProblemResponse(400, "Invalid path", "Path must be absolute and must not contain '..'");
  }

  const sanitizedReadId = sanitizeContainerId(containerId);
  const encodedPath = encodeURIComponent(readPath);
  const archiveReq = buildRequest(
    host,
    secrets,
    `/containers/${sanitizedReadId}/archive?path=${encodedPath}`,
    'GET',
  );

  const archiveResp = await dockerFetch(archiveReq.url, archiveReq.method, archiveReq.headers, 10000);

  if (!archiveResp.ok) {
    const detail = await archiveResp.text();
    if (archiveResp.status === 404) {
      return createProblemResponse(404, "File not found", `${readPath} does not exist in this container`);
    }
    return createProblemResponse(
      archiveResp.status || 502,
      "Failed to read file",
      detail,
    );
  }

  const tarBytes = new Uint8Array(await archiveResp.arrayBuffer());

  const MAX_FILE_READ = 2 * 1024 * 1024;

  if (tarBytes.length < 512) {
    return createProblemResponse(502, "Invalid archive response", "Tar stream too short");
  }

  const sizeOctal = new TextDecoder().decode(tarBytes.slice(124, 136)).replace(/\0/g, '').trim();
  const fileSize = parseInt(sizeOctal, 8);

  if (!Number.isFinite(fileSize) || fileSize < 0) {
    return createProblemResponse(502, "Invalid archive response", "Could not parse file size from tar header");
  }

  const truncated = fileSize > MAX_FILE_READ;
  const readSize = Math.min(fileSize, MAX_FILE_READ);

  const fileData = tarBytes.slice(512, 512 + readSize);

  const sampleSize = Math.min(fileData.length, 8192);
  let isBinary = false;
  for (let i = 0; i < sampleSize; i++) {
    if (fileData[i] === 0) {
      isBinary = true;
      break;
    }
  }

  if (isBinary) {
    await recordProxyAudit({
      organizationId: host.organization_id,
      actorUserId: auth.userId,
      action: 'container-fs-read',
      hostId: host.id,
      containerId: sanitizedReadId,
      path: readPath,
    });

    return new Response(JSON.stringify({
      content: '',
      size: fileSize,
      truncated: false,
      binary: true,
      message: 'Binary file — download is not supported in the current version.',
    }), { headers: corsHeaders });
  }

  const content = new TextDecoder().decode(fileData);

  await recordProxyAudit({
    organizationId: host.organization_id,
    actorUserId: auth.userId,
    action: 'container-fs-read',
    hostId: host.id,
    containerId: sanitizedReadId,
    path: readPath,
  });

  return new Response(JSON.stringify({
    content,
    size: fileSize,
    truncated,
    binary: false,
  }), { headers: corsHeaders });
}
