// js/utils/imageCompressor.js - Client-Side Image Compression & Resolution Limiter

window.compressImage = function(file, options = {}) {
    const maxWidth = options.maxWidth || 1080;
    const maxHeight = options.maxHeight || 1080;
    const quality = options.quality || 0.78;
    const outputType = options.outputType || 'image/jpeg';

    return new Promise((resolve) => {
        if (!file || !(file instanceof File || file instanceof Blob) || !file.type || !file.type.startsWith('image/')) {
            return resolve(file); // Return original if not an image
        }

        // SVG or tiny images don't need canvas compression
        if (file.type === 'image/svg+xml' || file.size < 50 * 1024) {
            return resolve(file);
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;

            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Downscale resolution if dimensions exceed limits
                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                // Smooth scaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) return resolve(file);
                        const fileName = (file.name || 'image').replace(/\.[^/.]+$/, "") + ".jpg";
                        const compressedFile = new File([blob], fileName, {
                            type: outputType,
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    },
                    outputType,
                    quality
                );
            };

            img.onerror = () => resolve(file);
        };

        reader.onerror = () => resolve(file);
    });
};
