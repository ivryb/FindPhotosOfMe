import { defineEventHandler, getRouterParam, setHeader, createError, sendStream } from 'h3';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const pathParam = getRouterParam(event, 'path');

  if (!pathParam) {
    throw createError({ statusCode: 400, statusMessage: 'Missing path' });
    }

  const objectKey = Array.isArray(pathParam) ? pathParam.join('/') : pathParam;

  let baseURL = config.r2PublicBaseURL as string | undefined;
  if (!baseURL) {
    const accountId = config.r2AccountId as string | undefined;
    const bucket = config.r2BucketName as string | undefined;
    if (!accountId || !bucket) {
      throw createError({
        statusCode: 500,
        statusMessage: 'R2 configuration missing',
      });
    }
    baseURL = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;
  }

  const targetUrl = `${baseURL}/${objectKey}`;

  const res = await fetch(targetUrl, {
    headers: {
      Accept: '*/*',
    },
  });

  if (!res.ok) {
    throw createError({
      statusCode: res.status,
      statusMessage: `Upstream fetch failed: ${res.statusText}`,
    });
  }

  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  setHeader(event, 'content-type', contentType);
  const cacheControl = res.headers.get('cache-control');
  if (cacheControl) setHeader(event, 'cache-control', cacheControl);

  return sendStream(event, res.body as any);
});
