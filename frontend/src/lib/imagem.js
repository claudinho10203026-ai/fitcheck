// Redimensiona uma imagem no navegador (canvas nativo, sem dependência) antes
// do upload, pra não mandar fotos de câmera gigantes pro servidor.
export async function redimensionarImagem(arquivo, tamanhoMaximo = 800, qualidade = 0.82) {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, tamanhoMaximo / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', qualidade); // "data:image/jpeg;base64,..."
}
