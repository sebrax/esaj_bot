import 'dotenv/config'
import puppeteer from 'puppeteer'
import { writeFileSync } from 'fs'

let list = []

const fetchProcesses = async () => {
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
        
        await page.click('.trocaDePagina a:last-of-type')
        currentPage++
    }
    
    await browser.close()

    // storeProcesses()
    filterList()
}

const fetchProcessDetails = async (processNumber) => {
    const browser = await puppeteer.launch({
        // headless: false,
        // devtools: true,
    })

    const page = await browser.newPage()
    await page.goto(process.env.CPOPG_URL)
    await page.setViewport({width: 1000, height: 1000})
    
    await page.type('#numeroDigitoAnoUnificado', processNumber.slice(0,15))
    await page.type('#foroNumeroUnificado', processNumber.slice(21, 25))

    await page.locator('#botaoConsultarProcessos').click()

    let lawyer = await page.waitForSelector('.fundoClaro .nomeParteEAdvogado')

    lawyer = await lawyer.evaluate(node => {
        let text = node.innerText
        const position = text.search('Advogado:')
        return position > 0 ? text.slice(position + 10, text.length) : false
    })
    
    const processAmount = await page.waitForSelector('#valorAcaoProcesso')
    const parsedAmount = await processAmount.evaluate(node => node.innerText.replaceAll('R$', '').trim())
    
    await browser.close()

    return{ lawyer, parsedAmount }
}

const filterList = () => {
    list = list.flat()
    // list = list.filter(p => p.processo)
    list = list.map(p => {
        let processNumber = p.processo
        let details = {}
        fetchProcessDetails(processNumber).then(res => {
            details = res   
        })
        return { ...p, details }
    })
    console.log(list[0])
    // storeProcesses()
}

const storeProcesses = async () => {
    writeFileSync('processos.json', JSON.stringify(list, null, 2), 'utf-8')
    console.log('Mal feito, feito!')
}

fetchProcesses()