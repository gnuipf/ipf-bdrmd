# BDRMD — Frontend

Frontend estático em HTML, CSS e JavaScript, preparado para GitHub Pages e Google Sheets.

## Estrutura

- `index.html`: página.
- `css/style.css`: estilo responsivo (tabela no desktop, cards em telas pequenas).
- `js/app.js`: leitura, pesquisa, filtros, ordenação, paginação e aniversários.
- `config.js`: URL pública CSV da planilha.
- `data/releases.json`: conjunto de demonstração com os registros fornecidos.

## Recursos 

- Pesquisa por banda, título, data ou tipo; ignora diferenças de caixa, acentos e caracteres de largura zero na busca, sem modificar o texto original.
- Filtros por tipo e ano.
- Ordenação por data, título ou banda.
- Paginação de 25, 50 ou 100 itens.
- Estatísticas de lançamentos, bandas e aniversários de hoje.
- Aniversários calculados pela data local; 29 de fevereiro é lembrado em 28 de fevereiro nos anos não bissextos.
- Renderização escapada para evitar que títulos da planilha sejam interpretados como HTML.
- CSV com campos entre aspas, vírgulas e quebras de linha.
