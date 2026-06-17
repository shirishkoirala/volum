export function isImageExtension(name: string) {
  return /\.(avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/i.test(name);
}

export function isVideoExtension(name: string) {
  return /\.(avi|flv|m4v|mkv|mov|mp4|mpeg|mpg|ogv|webm|wmv)$/i.test(name);
}

export function isAudioExtension(name: string) {
  return /\.(aac|flac|m4a|mp3|ogg|opus|wav|wma)$/i.test(name);
}

export function isTextExtension(name: string) {
  return /\.(cfg|conf|csv|css|env|go|html?|ini|java|jsx?|json|log|md|php|properties|py|rb|rs|rst|sh|sql|svg|toml|tsx?|txt|xml|ya?ml)$/i.test(name);
}
