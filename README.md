# PVdōTERRA Extractor

Extensão auxiliar para o Google Chrome que automatiza a coleta de Histórico de Pedidos no sistema EVO.

## Como Funciona
1. Ao acessar a página "Meus Pedidos" (OrderHistoryFull), a extensão injeta um script de coleta.
2. Ela automatiza o clique no botão "Ver Mais" repetidamente até que todo o histórico não visível seja expandido.
3. Além dos itens dos pedidos (ID, data, destinatário, PV, Valor), a extensão consegue "pescar" do DOM os dados de identificação (`Nome do Consultor` e `ID`) no popup de "Minha Conta".
4. Ao final, exporta os dados formatados (em JSON, CSV ou XML) com estrutura pronta para ser consumida pela Dashboard principal.

## Instalação (Modo Desenvolvedor)
Como se trata de uma ferramenta privada, a instalação se dá de forma manual:
1. Abra o navegador Chrome e digite na barra de endereços: `chrome://extensions/`
2. No canto superior direito, ative a chave **Modo do desenvolvedor** (Developer mode).
3. No canto superior esquerdo, clique em **Carregar sem compactação** (Load unpacked).
4. Selecione esta pasta (`/extension`). O ícone da ferramenta deverá aparecer ao lado da barra de URL.

---
*Apenas para uso de demonstração e integração interna (dados mockados).*
