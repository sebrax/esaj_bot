import { readFile, writeFile } from 'fs/promises'

let data = JSON.parse(await readFile('./processos.json', 'utf-8'))
let list = data.filter(p => !p.has_lawyer)

writeFile('./processos_filtrados.json', JSON.stringify(list, null, 2), 'utf-8')