import { log } from "./log.ts";
export const sendPhotoResults = async (ctx, imagePaths, r2ProxyBase) => {
    if (!imagePaths.length) {
        await ctx.reply("No matching photos found.");
        return;
    }
    const chatId = ctx.chat?.id;
    if (!chatId) {
        await ctx.reply("Cannot determine chat context.");
        return;
    }
    const chunkSize = 10;
    const chunks = [];
    for (let i = 0; i < imagePaths.length; i += chunkSize) {
        chunks.push(imagePaths.slice(i, i + chunkSize));
    }
    for (let groupIndex = 0; groupIndex < chunks.length; groupIndex++) {
        const group = chunks[groupIndex];
        const media = group.map((path, idx) => ({
            type: "photo",
            media: `${r2ProxyBase}/${path}`,
            caption: idx === 0 && groupIndex === 0
                ? `Found ${imagePaths.length} matching photos`
                : undefined,
        }));
        try {
            await ctx.api.sendMediaGroup(chatId, media);
        }
        catch (e) {
            log("Failed to send media group", { error: String(e) });
            await ctx.reply("Failed to send some results.");
            break;
        }
    }
};
//# sourceMappingURL=results.js.map