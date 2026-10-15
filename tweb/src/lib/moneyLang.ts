// Translations of the Money / Gram transfer strings. The official language packs do not
// carry these keys, so they are merged into the active pack on apply (see `applyLangPack`).
// English lives in `lang.ts`; a language that is not listed here falls back to it.

type Tr = Record<string, string>;

const KEYS = [
  'Money.Title', 'Money.Wallet', 'Money.AddFunds', 'Money.Send', 'Money.OnlyOfficial', 'Money.Setup',
  'Money.CreateInOfficial', 'Money.AddressCopied', 'Money.CopyAddress',
  'Money.Feature1Title', 'Money.Feature1Text', 'Money.Feature2Title', 'Money.Feature2Text',
  'Money.Feature3Title', 'Money.Feature3Text',
  'Money.Transactions', 'Money.Updating', 'Money.LoadingTx', 'Money.Received', 'Money.Sent', 'Money.Failed',
  'Money.Terms', 'Money.TermsLink', 'Money.Close',
  'GramTransferSent', 'GramTransferReceived', 'ActionGramTransferInbound', 'ActionGramTransferOutbound'
] as const;

function make(values: string[]): Tr {
  const out: Tr = {};
  KEYS.forEach((key, i) => out[key] = values[i]);
  return out;
}

const TRANSLATIONS: Record<string, Tr> = {
  ru: make([
    'Деньги', 'Кошелёк', 'Пополнить', 'Отправить', 'Доступно в официальном приложении Telegram',
    'Настраиваем ваш кошелёк. Обычно это занимает несколько секунд…',
    'Создайте кошелёк в официальном приложении Telegram.', 'Адрес скопирован', 'Скопировать адрес',
    'Мгновенные переводы', 'Отправляйте Gram в любом чате так же просто, как фото.',
    'Без комиссий', 'Первые 5 переводов в день бесплатны, остальные стоят почти ничего.',
    'Проверено блокчейном', 'Все транзакции записываются и могут быть проверены в публичном реестре.',
    'Транзакции', 'обновляется…', 'Загрузка транзакций…', 'Получено', 'Отправлено', 'не удалось',
    'Используя Кошелёк, вы принимаете %1$s.', 'Условия использования', 'Закрыть',
    'отправлено', 'получено', 'un1 отправил(а) вам **un2**', 'Вы отправили **un1**'
  ]),
  uk: make([
    'Гроші', 'Гаманець', 'Поповнити', 'Надіслати', 'Доступно в офіційному застосунку Telegram',
    'Налаштовуємо ваш гаманець. Зазвичай це займає кілька секунд…',
    'Створіть гаманець в офіційному застосунку Telegram.', 'Адресу скопійовано', 'Скопіювати адресу',
    'Миттєві перекази', 'Надсилайте Gram у будь-якому чаті так само просто, як фото.',
    'Без комісій', 'Перші 5 переказів на день безкоштовні, решта коштують майже нічого.',
    'Перевірено блокчейном', 'Усі транзакції записуються та можуть бути перевірені в публічному реєстрі.',
    'Транзакції', 'оновлюється…', 'Завантаження транзакцій…', 'Отримано', 'Надіслано', 'не вдалося',
    'Користуючись Гаманцем, ви приймаєте %1$s.', 'Умови використання', 'Закрити',
    'надіслано', 'отримано', 'un1 надіслав(ла) вам **un2**', 'Ви надіслали **un1**'
  ]),
  es: make([
    'Dinero', 'Cartera', 'Añadir fondos', 'Enviar', 'Disponible en la aplicación oficial de Telegram',
    'Configurando tu cartera. Normalmente tarda unos segundos…',
    'Crea tu cartera en la aplicación oficial de Telegram.', 'Dirección copiada', 'Copiar dirección',
    'Envía dinero al instante', 'Envía Gram en cualquier chat, como si compartieras una foto.',
    'Sin comisiones', 'Las primeras 5 transferencias al día son gratis, el resto cuestan casi nada.',
    'Verificado en blockchain', 'Todas las transacciones se registran y se pueden verificar en un libro público.',
    'Transacciones', 'actualizando…', 'Cargando transacciones…', 'Recibido', 'Enviado', 'fallida',
    'Al usar la Cartera aceptas los %1$s.', 'Términos del servicio', 'Cerrar',
    'enviado', 'recibido', 'un1 te envió **un2**', 'Enviaste **un1**'
  ]),
  de: make([
    'Geld', 'Wallet', 'Guthaben aufladen', 'Senden', 'In der offiziellen Telegram-App verfügbar',
    'Deine Wallet wird eingerichtet. Das dauert normalerweise nur wenige Sekunden…',
    'Erstelle deine Wallet in der offiziellen Telegram-App.', 'Adresse kopiert', 'Adresse kopieren',
    'Geld sofort senden', 'Sende Gram in jedem Chat – so einfach wie ein Foto.',
    'Keine Gebühren', 'Die ersten 5 Überweisungen pro Tag sind kostenlos, der Rest kostet fast nichts.',
    'Blockchain-verifiziert', 'Alle Transaktionen werden aufgezeichnet und sind in einem öffentlichen Register überprüfbar.',
    'Transaktionen', 'wird aktualisiert…', 'Transaktionen werden geladen…', 'Erhalten', 'Gesendet', 'fehlgeschlagen',
    'Durch die Nutzung der Wallet stimmst du den %1$s zu.', 'Nutzungsbedingungen', 'Schließen',
    'gesendet', 'erhalten', 'un1 hat dir **un2** gesendet', 'Du hast **un1** gesendet'
  ]),
  fr: make([
    'Argent', 'Portefeuille', 'Ajouter des fonds', 'Envoyer', "Disponible dans l'application Telegram officielle",
    'Configuration de votre portefeuille. Cela prend généralement quelques secondes…',
    "Créez votre portefeuille dans l'application Telegram officielle.", 'Adresse copiée', "Copier l'adresse",
    "Envoyez de l'argent instantanément", "Envoyez des Gram dans n'importe quelle discussion, comme une photo.",
    'Sans frais', 'Les 5 premiers transferts par jour sont gratuits, les suivants coûtent presque rien.',
    'Vérifié par la blockchain', 'Toutes les transactions sont enregistrées et vérifiables sur un registre public.',
    'Transactions', 'mise à jour…', 'Chargement des transactions…', 'Reçu', 'Envoyé', 'échec',
    'En utilisant le Portefeuille, vous acceptez les %1$s.', "Conditions d'utilisation", 'Fermer',
    'envoyé', 'reçu', 'un1 vous a envoyé **un2**', 'Vous avez envoyé **un1**'
  ]),
  it: make([
    'Denaro', 'Portafoglio', 'Aggiungi fondi', 'Invia', "Disponibile nell'app ufficiale di Telegram",
    'Configurazione del portafoglio in corso. Di solito richiede pochi secondi…',
    "Crea il tuo portafoglio nell'app ufficiale di Telegram.", 'Indirizzo copiato', 'Copia indirizzo',
    'Invia denaro all\'istante', 'Invia Gram in qualsiasi chat, come condividere una foto.',
    'Nessuna commissione', 'I primi 5 trasferimenti al giorno sono gratuiti, gli altri costano quasi nulla.',
    'Verificato su blockchain', 'Tutte le transazioni sono registrate e verificabili su un registro pubblico.',
    'Transazioni', 'aggiornamento…', 'Caricamento transazioni…', 'Ricevuto', 'Inviato', 'non riuscita',
    'Usando il Portafoglio accetti i %1$s.', 'Termini di servizio', 'Chiudi',
    'inviato', 'ricevuto', 'un1 ti ha inviato **un2**', 'Hai inviato **un1**'
  ]),
  pt: make([
    'Dinheiro', 'Carteira', 'Adicionar fundos', 'Enviar', 'Disponível no aplicativo oficial do Telegram',
    'Configurando sua carteira. Isso costuma levar alguns segundos…',
    'Crie sua carteira no aplicativo oficial do Telegram.', 'Endereço copiado', 'Copiar endereço',
    'Envie dinheiro instantaneamente', 'Envie Gram em qualquer chat, como compartilhar uma foto.',
    'Sem taxas', 'As primeiras 5 transferências por dia são grátis, as demais custam quase nada.',
    'Verificado em blockchain', 'Todas as transações são registradas e verificáveis em um registro público.',
    'Transações', 'atualizando…', 'Carregando transações…', 'Recebido', 'Enviado', 'falhou',
    'Ao usar a Carteira, você concorda com os %1$s.', 'Termos de Serviço', 'Fechar',
    'enviado', 'recebido', 'un1 enviou **un2** para você', 'Você enviou **un1**'
  ]),
  tr: make([
    'Para', 'Cüzdan', 'Para Ekle', 'Gönder', 'Resmi Telegram uygulamasında kullanılabilir',
    'Cüzdanınız hazırlanıyor. Bu genellikle birkaç saniye sürer…',
    'Cüzdanınızı resmi Telegram uygulamasında oluşturun.', 'Adres kopyalandı', 'Adresi kopyala',
    'Anında para gönderin', 'Bir fotoğraf paylaşır gibi her sohbette Gram gönderin.',
    'Komisyon yok', 'Günde ilk 5 transfer ücretsiz, gerisi neredeyse hiçbir şey tutmuyor.',
    'Blokzincir ile doğrulanmış', 'Tüm işlemler kaydedilir ve herkese açık bir defterde doğrulanabilir.',
    'İşlemler', 'güncelleniyor…', 'İşlemler yükleniyor…', 'Alındı', 'Gönderildi', 'başarısız',
    'Cüzdanı kullanarak %1$s kabul etmiş olursunuz.', 'Hizmet Şartları', 'Kapat',
    'gönderildi', 'alındı', 'un1 size **un2** gönderdi', '**un1** gönderdiniz'
  ]),
  pl: make([
    'Pieniądze', 'Portfel', 'Dodaj środki', 'Wyślij', 'Dostępne w oficjalnej aplikacji Telegram',
    'Konfigurowanie portfela. Zwykle trwa to kilka sekund…',
    'Utwórz portfel w oficjalnej aplikacji Telegram.', 'Skopiowano adres', 'Kopiuj adres',
    'Wysyłaj pieniądze natychmiast', 'Wysyłaj Gram na dowolnym czacie, tak jak zdjęcie.',
    'Bez opłat', 'Pierwsze 5 przelewów dziennie jest darmowych, reszta kosztuje prawie nic.',
    'Zweryfikowane w blockchainie', 'Wszystkie transakcje są zapisywane i można je zweryfikować w publicznym rejestrze.',
    'Transakcje', 'aktualizowanie…', 'Ładowanie transakcji…', 'Otrzymano', 'Wysłano', 'nieudana',
    'Korzystając z Portfela, akceptujesz %1$s.', 'Warunki korzystania z usługi', 'Zamknij',
    'wysłano', 'otrzymano', 'un1 wysłał(a) Ci **un2**', 'Wysłano **un1**'
  ]),
  nl: make([
    'Geld', 'Portemonnee', 'Saldo toevoegen', 'Verzenden', 'Beschikbaar in de officiële Telegram-app',
    'Je portemonnee wordt ingesteld. Dit duurt meestal enkele seconden…',
    'Maak je portemonnee aan in de officiële Telegram-app.', 'Adres gekopieerd', 'Adres kopiëren',
    'Verstuur direct geld', 'Stuur Gram in elke chat, net als een foto delen.',
    'Geen kosten', 'De eerste 5 overboekingen per dag zijn gratis, de rest kost bijna niets.',
    'Blockchain-geverifieerd', 'Alle transacties worden vastgelegd en zijn controleerbaar in een openbaar grootboek.',
    'Transacties', 'bijwerken…', 'Transacties laden…', 'Ontvangen', 'Verzonden', 'mislukt',
    'Door de Portemonnee te gebruiken ga je akkoord met de %1$s.', 'Servicevoorwaarden', 'Sluiten',
    'verzonden', 'ontvangen', 'un1 heeft je **un2** gestuurd', 'Je hebt **un1** gestuurd'
  ]),
  id: make([
    'Uang', 'Dompet', 'Tambah Dana', 'Kirim', 'Tersedia di aplikasi resmi Telegram',
    'Menyiapkan dompet Anda. Biasanya hanya butuh beberapa detik…',
    'Buat dompet Anda di aplikasi resmi Telegram.', 'Alamat disalin', 'Salin alamat',
    'Kirim Uang Seketika', 'Kirim Gram di obrolan mana pun, semudah berbagi foto.',
    'Tanpa Biaya', '5 transfer pertama setiap hari gratis, sisanya hampir tanpa biaya.',
    'Diverifikasi Blockchain', 'Semua transaksi dicatat dan dapat diverifikasi di buku besar publik.',
    'Transaksi', 'memperbarui…', 'Memuat transaksi…', 'Diterima', 'Terkirim', 'gagal',
    'Dengan menggunakan Dompet, Anda menyetujui %1$s.', 'Ketentuan Layanan', 'Tutup',
    'terkirim', 'diterima', 'un1 mengirimi Anda **un2**', 'Anda mengirim **un1**'
  ]),
  ar: make([
    'الأموال', 'المحفظة', 'إضافة رصيد', 'إرسال', 'متاح في تطبيق تيليجرام الرسمي',
    'جارٍ إعداد محفظتك. يستغرق ذلك عادةً بضع ثوانٍ…',
    'أنشئ محفظتك في تطبيق تيليجرام الرسمي.', 'تم نسخ العنوان', 'نسخ العنوان',
    'أرسل الأموال فورًا', 'أرسل Gram في أي محادثة، تمامًا مثل مشاركة صورة.',
    'بدون رسوم', 'أول 5 تحويلات يوميًا مجانية، والباقي بتكلفة زهيدة جدًا.',
    'موثّق بالبلوكتشين', 'تُسجَّل جميع المعاملات ويمكن التحقق منها في سجل عام.',
    'المعاملات', 'جارٍ التحديث…', 'جارٍ تحميل المعاملات…', 'مستلم', 'مُرسل', 'فشلت',
    'باستخدامك المحفظة فإنك توافق على %1$s.', 'شروط الخدمة', 'إغلاق',
    'مُرسل', 'مستلم', 'أرسل لك un1 **un2**', 'لقد أرسلت **un1**'
  ]),
  zh: make([
    '钱包', '钱包', '充值', '发送', '请在 Telegram 官方应用中使用',
    '正在设置您的钱包，通常只需几秒钟…',
    '请在 Telegram 官方应用中创建钱包。', '地址已复制', '复制地址',
    '即时转账', '在任何聊天中发送 Gram，就像分享照片一样简单。',
    '零手续费', '每天前 5 笔转账免费，其余几乎不收费。',
    '区块链验证', '所有交易均有记录，并可在公开账本上验证。',
    '交易记录', '更新中…', '正在加载交易…', '已收到', '已发送', '失败',
    '使用钱包即表示您同意%1$s。', '服务条款', '关闭',
    '已发送', '已收到', 'un1 向您发送了 **un2**', '您发送了 **un1**'
  ]),
  ja: make([
    'マネー', 'ウォレット', '資金を追加', '送金', 'Telegram 公式アプリで利用できます',
    'ウォレットを設定しています。通常は数秒で完了します…',
    'Telegram 公式アプリでウォレットを作成してください。', 'アドレスをコピーしました', 'アドレスをコピー',
    'すぐに送金', '写真を共有する感覚で、どのチャットでも Gram を送れます。',
    '手数料なし', '1日5回までの送金は無料、それ以降もほとんど無料です。',
    'ブロックチェーンで検証済み', 'すべての取引は記録され、公開台帳で確認できます。',
    '取引', '更新中…', '取引を読み込み中…', '受取', '送金', '失敗',
    'ウォレットを利用すると、%1$sに同意したことになります。', '利用規約', '閉じる',
    '送金済み', '受取済み', 'un1 さんから **un2** が届きました', '**un1** を送金しました'
  ]),
  ko: make([
    '머니', '지갑', '자금 추가', '보내기', 'Telegram 공식 앱에서 사용할 수 있습니다',
    '지갑을 설정하는 중입니다. 보통 몇 초 정도 걸립니다…',
    'Telegram 공식 앱에서 지갑을 만드세요.', '주소가 복사되었습니다', '주소 복사',
    '즉시 송금', '사진을 공유하듯 어떤 채팅에서든 Gram을 보내세요.',
    '수수료 없음', '하루 처음 5건의 송금은 무료이며, 이후에도 거의 무료입니다.',
    '블록체인 검증', '모든 거래가 기록되며 공개 원장에서 확인할 수 있습니다.',
    '거래 내역', '업데이트 중…', '거래 불러오는 중…', '받음', '보냄', '실패',
    '지갑을 사용하면 %1$s에 동의하는 것으로 간주됩니다.', '서비스 약관', '닫기',
    '보냄', '받음', 'un1 님이 **un2**을(를) 보냈습니다', '**un1**을(를) 보냈습니다'
  ])
};

const CARD_NAME: Record<string, string> = {
  'ru': 'Кошелёк Telegram',
  'uk': 'Гаманець Telegram',
  'es': 'Cartera de Telegram',
  'de': 'Telegram Wallet',
  'fr': 'Portefeuille Telegram',
  'it': 'Portafoglio Telegram',
  'pt': 'Carteira do Telegram',
  'tr': 'Telegram Cüzdan',
  'pl': 'Portfel Telegram',
  'nl': 'Telegram-portemonnee',
  'id': 'Dompet Telegram',
  'ar': 'محفظة تيليجرام',
  'zh': 'Telegram 钱包',
  'ja': 'Telegram ウォレット',
  'ko': 'Telegram 지갑'
};

export function getMoneyTranslations(langCode: string): Tr | undefined {
  const code = (langCode || '').split('-', 1)[0].toLowerCase();
  const base = TRANSLATIONS[code];
  return base && {...base, 'Money.CardName': CARD_NAME[code]};
}
