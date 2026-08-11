# Ponte genérica de catraca (para marcas sem validação externa nativa)

## Quando usar isso

A tela **Controle de Acesso** do sistema já expõe um endpoint HTTP
(`GET /api/acesso/verificar`) que qualquer catraca pode chamar diretamente
se ela tiver a opção de **"validação externa"/"validação online"/"webhook"**
configurável. A Control iD tem isso nativamente na maioria dos modelos.

Se a sua catraca **não** tiver essa opção (comum em vários modelos
Intelbras, Topdata, Henry e ZKTeco, dependendo do firmware/software), você
precisa de uma "ponte": um programinha rodando num PC ou Raspberry Pi na
mesma rede da catraca, que:

1. Recebe o evento da catraca ("fulano bateu o dedo/rosto, o código dele é X")
   — usando o SDK/protocolo que o fabricante daquele modelo fornece.
2. Chama o endpoint `/api/acesso/verificar` deste sistema perguntando
   "esse CPF pode entrar?".
3. Manda pro equipamento o comando de abrir ou negar, de acordo com a resposta.

Este `index.js` é o **esqueleto** dos passos 2 e 3 — já prontos e testados.
O passo 1 e a parte final do passo 3 (falar com o hardware em si) variam por
fabricante/modelo/SDK, então ficam marcados com `// TODO` pra você (ou o
técnico/integrador da catraca) completar com o SDK específico do
equipamento. Sem o manual/SDK do modelo exato não tem como eu adivinhar o
protocolo — mas a parte "conversar com o sistema da academia" já está 100%
pronta.

## Como usar

```bash
cd integracoes/ponte-catraca
npm install
cp .env.example .env
# edite o .env com a URL do seu sistema e a chave de integração
# (gerada na tela Controle de Acesso > Configurar catraca)
node index.js
```

## O que falta pra cada marca (o `// TODO` do index.js)

- **Control iD**: normalmente você **não precisa dessa ponte** — configure a
  validação externa direto no equipamento (veja instruções na tela
  Controle de Acesso).
- **Intelbras**: verifique se o modelo tem "validação online" nativa
  primeiro (mesma dica acima). Se não tiver, o SDK/protocolo de integração é
  fornecido pela Intelbras para integradores — normalmente envolve
  comunicação TCP/IP local com o equipamento.
- **Topdata / Henry / ZKTeco / outras**: cada fabricante tem seu próprio SDK
  (ex: ZKTeco tem SDKs para Windows/Linux com callbacks de evento). Consulte
  o suporte técnico do fabricante ou o integrador que instalou o
  equipamento pra saber como (a) capturar o evento de reconhecimento e
  (b) mandar o comando de abrir/negar.

Se você me passar o manual técnico/SDK do modelo exato, eu completo os
`// TODO` deste arquivo.
