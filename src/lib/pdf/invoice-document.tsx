import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Canvas, Document, Image as PdfImage, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { calculateInvoice, formatInvoiceMoney, invoiceSchema, type Invoice } from '@/lib/invoice'

// The source is always the bundled local asset, never invoice input.
const logoPath = path.join(process.cwd(), 'public', 'branding', 'transportes-acevedo-hernandez.png')
const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 45, paddingHorizontal: 36, fontFamily: 'Helvetica', fontSize: 12, color: '#20252b' },
  header: { marginBottom: 14 },
  overview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 4, borderBottomWidth: 1.5, borderBottomColor: '#20252b' },
  invoiceMeta: { width: 350 },
  invoiceDetails: { marginTop: 10 },
  logo: { width: 124, height: 93, objectFit: 'contain', marginTop: -6, transform: 'translateY(-14)' },
  title: { width: 350, height: 33, fontSize: 30, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8, color: '#111111', marginBottom: 8, transform: 'translateY(6)' },
  parties: { flexDirection: 'row', marginTop: 20, marginBottom: 20 },
  party: { width: '50%', paddingRight: 16 },
  partyHeading: { borderBottomWidth: 0.7, borderBottomColor: '#d7dce1', paddingBottom: 5, marginBottom: 7 },
  label: { fontFamily: 'Helvetica-Bold' },
  partyName: { fontFamily: 'Helvetica-Bold', color: '#252b33' },
  partyText: { fontSize: 11, lineHeight: 1.45, marginBottom: 3 },
  headingText: { lineHeight: 1.3 },
  headings: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252b33', color: '#ffffff', paddingVertical: 6, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#d7dce1', paddingVertical: 8 },
  concept: { width: '49%', paddingHorizontal: 7, lineHeight: 1.3 },
  quantity: { width: '12%', textAlign: 'right', paddingHorizontal: 4 },
  price: { width: '19%', textAlign: 'right', paddingHorizontal: 4 },
  amount: { width: '20%', textAlign: 'right', paddingHorizontal: 7 },
  totals: { width: '53%', alignSelf: 'flex-end', marginTop: 18 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 7 },
  grandTotal: { backgroundColor: '#252b33', color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 16 },
  footerBrand: { position: 'absolute', bottom: 20, left: 36, right: 36, textAlign: 'center', fontFamily: 'Helvetica', fontSize: 11, color: '#68717c' },
  footer: { position: 'absolute', bottom: 20, right: 36, fontSize: 11, color: '#68717c' },
})

function breakWord(word: string) {
  return word.match(/.{1,18}/gu) ?? [word]
}

function Party({ title, party }: { title: string; party: Invoice['issuer'] }) {
  return <View style={styles.party}>
    <View style={styles.partyHeading}><Text style={styles.label}>{title.toUpperCase()}</Text></View>
    {[party.name, `NIF/CIF: ${party.taxId}`, party.address, `${party.postalCode} ${party.city}`].map((value, i) => <Text key={i} style={i === 0 ? [styles.partyText, styles.partyName] : styles.partyText} hyphenationCallback={breakWord}>{value}</Text>)}
  </View>
}

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const validated = invoiceSchema.parse(invoice)
  const amounts = calculateInvoice(validated)
  const logo = { data: readFileSync(logoPath), format: 'png' as const }
  const date = validated.date.split('-').reverse().join('/')
  const totals = [
    ['Subtotal', amounts.subtotal],
    [`Descuento (${validated.discountPercent.replace('.', ',')} %)`, amounts.discount],
    ['Base imponible', amounts.taxableBase],
    [`IVA (${validated.vatPercent.replace('.', ',')} %)`, amounts.vat],
    ['TOTAL', amounts.total],
  ]
  return <Document title={`Factura ${validated.number}`} author="Transportes Acevedo Hernandez">
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.header} wrap={false}>
        <View style={styles.overview}>
          <View style={styles.invoiceMeta}>
            <Canvas style={styles.title} paint={painter => {
              // Fill and lightly stroke once: genuinely heavier, still searchable text.
              painter.save().font('Helvetica-Bold', 30).fillColor('#111111').strokeColor('#111111').lineWidth(0.35)
                .text('FACTURA', 0, 0, { fill: true, stroke: true, characterSpacing: 0.8, lineBreak: false })
                .restore()
              return null
            }} />
          </View>
          <PdfImage style={styles.logo} src={logo} />
        </View>
        <Text style={styles.invoiceDetails}>{`Número: ${validated.number}    Fecha: ${date}`}</Text>
        <View style={styles.parties}>
          <Party title="Emisor" party={validated.issuer} />
          <Party title="Facturar a" party={validated.recipient} />
        </View>
      </View>
      <View style={styles.headings} fixed>
        <Text style={[styles.concept, styles.headingText]}>Concepto</Text>
        <Text style={[styles.quantity, styles.headingText]}>Cantidad</Text>
        <Text style={[styles.price, styles.headingText]}>Precio</Text>
        <Text style={[styles.amount, styles.headingText]}>Total</Text>
      </View>
      {validated.lines.map((line, i) => <View key={i} style={styles.row} wrap={false}>
        <Text style={styles.concept} hyphenationCallback={breakWord}>{line.description}</Text>
        <Text style={styles.quantity}>{line.quantity.replace(/\.00$/, '').replace('.', ',')}</Text>
        <Text style={styles.price}>{formatInvoiceMoney(line.unitPrice)}</Text>
        <Text style={styles.amount}>{formatInvoiceMoney(amounts.lines[i])}</Text>
      </View>)}
      <View style={styles.totals} wrap={false}>
        {totals.map(([label, amount], i) => <View key={label} style={i === 4 ? [styles.totalRow, styles.grandTotal] : styles.totalRow}>
          <Text>{label}</Text><Text>{formatInvoiceMoney(amount)}</Text>
        </View>)}
      </View>
      <Text style={styles.footerBrand} fixed>Transportes Acevedo Hernandez</Text>
      <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </Page>
  </Document>
}
