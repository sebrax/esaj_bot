import 'dotenv/config'
import puppeteer from 'puppeteer'
import { writeFileSync } from 'fs'

let list = []

const fetchProcesses = async () => {
    console.info('Buscando processos...')

    const browser = await puppeteer.launch({
        // headless: false,
        // devtools: true
    })

    const page = await browser.newPage()
    await page.goto(process.env.CJPG_URL)
    await page.setViewport({width: 1000, height: 1000})

    let currentPage = 1
    let totalPages = process.env.TOTAL_PAGES || 1

    while (currentPage <= totalPages) {
        
        const processes = await page.evaluate(() => {
            function sanitizeNode(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    // Remove leading/trailing whitespaces, tabs, and newlines
                    node.textContent = node.textContent.replace(/[\n\t\r]+/g, ' ').trim();
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    // Recursively sanitize child nodes for elements
                    Array.from(node.childNodes).forEach(sanitizeNode);
                }
            }
    
            const processes = document.querySelectorAll('.fundocinza1')
    
            return Array.from(processes).map(p => {
                const processo =            p.querySelector('td:nth-child(2) tr:nth-child(1) span')?.innerText?.trim()
                const comarca =             p.querySelector('td:nth-child(2) tr:nth-child(5)')?.innerText?.trim().replace('Comarca: ', '')
                const foro =                p.querySelector('td:nth-child(2) tr:nth-child(6)')?.innerText?.trim().replace('Foro: ', '')
                const disponibilizacao =    p.querySelector('td:nth-child(2) tr:nth-child(8)')?.innerText?.trim().replace('Data de Disponibilização: ', '')
                let texto =                 p.querySelector('td:nth-child(2) tr:nth-child(9) div:nth-child(2) span')
                sanitizeNode(texto)
                texto = texto.innerText

                return { processo, comarca, foro, disponibilizacao }
            })
        })
    
        list.push(processes)
        
        await page.locator('.trocaDePagina a:last-of-type').click()
        currentPage++
    }
    
    await browser.close()

    console.info('Processos encontrados: ', [...list.flat()].length)
    console.log('Iniciando segunda etapa...')

    filterList().then(() => {
        store(list)
    })
}

const fetchProcessDetails = async (processNumber, index) => {
    setTimeout(() => {}, 3000)

    console.info(`Buscando detalhes do processo ${index + 1} de ${list.length}...`)

    const browser = await puppeteer.launch({
        // headless: false,
        // devtools: true,
    })

    const page = await browser.newPage()
    await page.goto(process.env.CPOPG_URL)
    await page.setViewport({width: 1000, height: 1000})
    
    await page.locator('#numeroDigitoAnoUnificado').fill(processNumber.slice(0,15))
    await page.locator('#foroNumeroUnificado').fill(processNumber.slice(21, 25))

    await page.$eval('#botaoConsultarProcessos', el => el.click())

    let lawyerSection = await page.waitForSelector('#tablePartesPrincipais tr:nth-child(1) td:nth-child(2)')
    const hasLawyer = await lawyerSection.evaluate(node => {
        return /Advogada|Advogado/i.test(node.innerText)
    })
    
    let parsedAmount = null

    try {
        const amount = await page.waitForSelector('#valorAcaoProcesso')
        parsedAmount = await amount.evaluate(node => {
            return node.innerText.replaceAll('R$', '').trim()
        })
    } catch (error) {
    }	

    await browser.close()

    return { hasLawyer, parsedAmount }
}

const filterList = async () => {
    list = list.flat()

    for(let i = 0; i < list.length; i++) {
        await fetchProcessDetails(list[i].processo, i).then(res => {
            list[i].has_lawyer = res.hasLawyer
            list[i].amount = res.parsedAmount
        })
    }
}

const store = async (list) => {
    // const filtered = list.filter(p => p.has_lawyer)
    writeFileSync('processos.json', JSON.stringify(list, null, 2), 'utf-8')
    console.log('Mal feito, feito!')
    /* if(filtered.length > 0) {
        console.log(`Encontrados ${filtered} processos com advogados!`)
    }
    else {
        console.log('Nenhum processo sem advogados encontrado :(')
    } */
}

fetchProcesses()