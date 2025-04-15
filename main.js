import 'dotenv/config'
import puppeteer from 'puppeteer'
import { writeFileSync } from 'fs'
import { useGetUpdatedUrl } from './utils.js'

let list = []

const fetchProcesses = async () => {
    console.info('Buscando processos...')

    const browser = await puppeteer.launch({
        // headless: false,
        // devtools: true
    })

    const page = await browser.newPage()
    await page.goto(useGetUpdatedUrl())
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

    const seen = new Set()
    list = list.flat().filter(p => {
        const duplicate = seen.has(p.processo)
        seen.add(p.processo)
        return !duplicate
    })

    console.info(`Processos encontrados: ${list.length}`)
    console.log('Agora buscaremos o valor dos processos e se já possuem advogados...')

    addDetails().then(() => {
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

    let hasLawyer = null

    try {
        let lawyerSection = await page.waitForSelector('#tablePartesPrincipais tr:nth-child(1) td:nth-child(2)')
        hasLawyer = await lawyerSection.evaluate(node => {
            return /Advogada|Advogado/i.test(node.innerText)
        })
    } catch (error) {
        console.error('Sessão Advogado não localizada')
        return { hasLawyer: false }
    }

    let parsedAmount = null

    try {
        const amount = await page.waitForSelector('#valorAcaoProcesso')
        parsedAmount = await amount.evaluate(node => {
            return node.innerText.trim()
        })
    } catch (error) {
    }

    await browser.close()

    return { hasLawyer, parsedAmount }
}

const addDetails = async () => {
    for(let i = 0; i < list.length; i++) {
        await fetchProcessDetails(list[i].processo, i).then(res => {
            list[i].has_lawyer = res.hasLawyer
            list[i].amount = res.parsedAmount
        })
    }
}

const store = async (list, unfiltered = false) => {
    let data = unfiltered ? list : list.filter(p => p.has_lawyer === false)

    writeFileSync('processos.json', JSON.stringify(data, null, 2), 'utf-8')
    console.log('Mal feito, feito!')

    console.info(data.length > 0 ? `Encontrados ${data.length} processos sem advogados de ${list.length} analizados :D` : 'Nenhum processo sem advogados encontrado :(')
}

fetchProcesses()