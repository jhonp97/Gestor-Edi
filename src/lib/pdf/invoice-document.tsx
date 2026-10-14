import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Document, Image as PdfImage, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { calculateInvoice, formatInvoiceMoney, invoiceSchema, type Invoice } from '@/lib/invoice'

// The source is always the bundled local asset, never invoice input.
const logoPath = path.join(process.cwd(), 'public', 'branding', 'transportes-acevedo-hernandez.png')
const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 45, paddingHorizontal: 36, fontFamily: 'Helvetica', fontSize: 9, color: '#20252b' },
  header: { marginBottom: 14 },
  branding: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 60, marginBottom: 14 },
  brand: { fontSize: 17, fontFamily: 'Helvetica-Bold', width: 310 },
  logo: { width: 80, height: 60, objectFit: 'contain' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 5 },
  parties: { flexDirection: 'row', marginTop: 15, marginBottom: 15 },
  party: { width: '50%', paddingRight: 16 },
  label: { fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  partyText: { fontSize: 8, lineHeight: 1.2 },
  headings: { flexDirection: 'row', backgroundColor: '#252b33', color: '#ffffff', paddingVertical: 8, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#d7dce1', paddingVertical: 8 },
  concept: { width: '49%', paddingHorizontal: 7, lineHeight: 1.3 },
  quantity: { width: '12%', textAlign: 'right', paddingHorizontal: 4 },
  price: { width: '19%', textAlign: 'right', paddingHorizontal: 4 },
  amount: { width: '20%', textAlign: 'right', paddingHorizontal: 7 },
  totals: { width: '53%', alignSelf: 'flex-end', marginTop: 18 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 7 },
  grandTotal: { backgroundColor: '#252b33', color: '#ffffff', fontFamily: 'Helvetica-Bold', fontSize: 12 },
  footer: { position: 'absolute', bottom: 20, right: 36, fontSize: 8, color: '#68717c' },
})

function breakWord(word: string) {
  return word.match(/.{1,18}/gu) ?? [word]
}

function Party({ title, party }: { title: string; party: Invoice['issuer'] }) {
  return <View style={styles.party}>
    <Text style={styles.label}>{title}</Text>
    {[party.name, `NIF/CIF: ${party.taxId}`, party.address, `${party.postalCode} ${party.city}`].map((value, i) => <Text key={i} style={styles.partyText} hyphenationCallback={breakWord}>{value}</Text>)}
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
        <View style={styles.branding}>
          <Text style={styles.brand}>Transportes Acevedo Hernandez</Text>
          <PdfImage style={styles.logo} src={logo} />
        </View>
        <Text style={styles.title}>FACTURA</Text>
        <Text>Número: {validated.number}    Fecha: {date}</Text>
        <View style={styles.parties}>
          <Party title="Emisor" party={validated.issuer} />
          <Party title="Facturar a" party={validated.recipient} />
        </View>
      </View>
      <View style={styles.headings} fixed>
        <Text style={styles.concept}>Concepto</Text>
        <Text style={styles.quantity}>Cantidad</Text>
        <Text style={styles.price}>Precio</Text>
        <Text style={styles.amount}>Total</Text>
      </View>
      {validated.lines.map((line, i) => <View key={i} style={styles.row} wrap={false}>
        <Text style={styles.concept} hyphenationCallback={breakWord}>{line.description}</Text>
        <Text style={styles.quantity}>{line.quantity.replace('.', ',')}</Text>
        <Text style={styles.price}>{formatInvoiceMoney(line.unitPrice)}</Text>
        <Text style={styles.amount}>{formatInvoiceMoney(amounts.lines[i])}</Text>
      </View>)}
      <View style={styles.totals} wrap={false}>
        {totals.map(([label, amount], i) => <View key={label} style={i === 4 ? [styles.totalRow, styles.grandTotal] : styles.totalRow}>
          <Text>{label}</Text><Text>{formatInvoiceMoney(amount)}</Text>
        </View>)}
      </View>
      <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </Page>
  </Document>
}
