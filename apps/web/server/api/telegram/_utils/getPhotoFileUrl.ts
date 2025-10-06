export const getPhotoFileUrl = async (
  botToken: string,
  fileId: string
): Promise<string | null> => {
  const fileRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const fileData = await fileRes.json();
  if (!fileData.ok) return null;
  const path = fileData.result.file_path as string;
  return `https://api.telegram.org/file/bot${botToken}/${path}`;
};
