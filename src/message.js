const p_classes = require('../open_fints_js_client-master/lib/Parser'),
  Parser = p_classes.Parser,
  ParseError = p_classes.ParseError,
  classes = require('../open_fints_js_client-master/lib/Classes'),
  NULL = classes.NULL,
  Helper = classes.Helper,
  Segment = classes.Segment,
  h = require('./helper');

let message = function (proto_version = 300) {
  var me_msg = this;
  me_msg.segments = [];
  me_msg.segments_ctr = 0;
  me_msg.sign_it = null;
  me_msg.hnvsk = null;
  me_msg.msg_nr = 0;
  me_msg.proto_version = proto_version;

  let createSegment = h.types.createSegment;

  me_msg.sign = function (sign_obj) {
    // sign_obj = {'pin':pin,'tan':tan,'sys_id':0}// Tan bitte null setzen wenn nicht benötigt
    me_msg.sign_it = sign_obj;
  };

  me_msg.init = function (dialog_id, ongoing_nr, blz, kunden_id) {
    // this is called wenn es ein outgoing message ist
    me_msg.msg_nr = ongoing_nr;
    var seg = new Segment();
    seg.init('HNHBK', 1, 3, 0);
    me_msg.addSeg(seg);
    seg.store.addDE(h.padWithZero(0)); // Länge
    seg.store.addDE(me_msg.proto_version + ''); // Version
    seg.store.addDE(dialog_id); // Dialog-ID, bei 0 beginnend wird von KI bekannt gegeben
    seg.store.addDE(me_msg.msg_nr); // Nachrichten-Nr. streng monoton von 1 ab steigen
    if (me_msg.sign_it) { // NUr für das Pin/Tan Verfahren 1 Schritt!
      // Infos hierzu: http://www.hbci-zka.de/dokumente/spezifikation_deutsch/fintsv3/FinTS_3.0_Security_Sicherheitsverfahren_HBCI_Rel_20130718_final_version.pdf Punkt B5.1
      // http://www.hbci-zka.de/dokumente/spezifikation_deutsch/fintsv3/FinTS_3.0_Security_Sicherheitsverfahren_PINTAN_Rel_20101027_final_version.pdf B8.4
      // Sicherheitsprofil ["PIN",1] = PIN und 1 Schrittverfahren
      // Sicherheitsfunktion: 999 - 1 SChrittverfahren / 2Schritt siehe BPD
      // Sicherheitskontrollreferenz: 1 // Muss mit Signaturabschluss übereinstimmen
      // Bereich der Sicherheitsapplikation,kodiert: 1 // 1: Signaturkopf und HBCI-Nutzdaten (SHM)
      // Rolle des Sicherheitslieferanten,kodiert: 1 // 1: Der Unterzeichner ist Herausgeber der signierten Nachricht, z.B. Erfasser oder Erstsignatur (ISS)
      // Sicherheitsidentifikation, Details: [1,null,0]
      //		Bezeichner Sicherheitspartei	1		1: Message Sender (MS), wenn ein Kunde etwas an sein Kreditinstitut sendet
      //		CID nur Chipkarte				null
      // 		Id der Partei nur Software		0		Code, welcher die (Kommunikations-)Partei identifiziert. Dieses Feld muss eine gültige, zuvor vom Banksystem angeforderte Kundensystem-ID enthalten (analog zum RSA-Verfahren). Dies gilt auch fürZweit-und Drittsignaturen.
      //			beim Erstmal noch 0, dann auf Antwort von Bank in HISYN warten und das verwenden!
      //	Sicherheitsreferenznummer: 1 Verhinderung der Doppeleinreichung Bei softwarebasierten Verfahren wird die Sicherheitsreferenznummer auf Basis des DE Kundensystem-ID und des DE Benutzerkennung der DEG Schlüsselnamen verwaltet.
      //							bei Pin/Tan kann das auch einfach bei 1 beibehalten werden :), sonst müsste man das aber eigtl. incrementieren
      // 	Sicherheitsdatum und -uhrzeit [1,"20141210","003515"], 1: Bedeutung = Sicherheitszeitstempel (STS)
      //	Hashalgorithmus: [1,999,1]
      //		Verwendung des Hashalgorithmus,kodiert	1: Owner Hashing (OHA) (nur)
      //		Hashalgorithmus,kodiert					999: Gegenseitig vereinbart (ZZZ); hier: RIPEMD-160 ( gibt noch andere Werte 1-6 vorallem SHAxxx
      // 		Bezeichner für Hashalgorithmusparameter	1: IVC (Initialization value, clear text)
      //	Signaturalgorithmus: [6,10,16]
      //		Verwendung des Signaturalgorithmus, kodiert 6: Owner Signing (OSG)
      //		10: RSA-Algorithmus (bei RAH und RDH)
      //		Operationsmodus, kodiert	16:	ISO 9796-1 (bei RDH)
      //	Schlüsselname	[280,blz,kunden_id,"S",0,0]
      //		Kreditinstitutskennung	280,blz
      //		Benutzerkennung 		kunden_id
      //		Schlüsselart			S	S: Signierschlüsse
      //		Schlüsselnummer			0
      //		Schlüsselversion		0
      var signature_id = (me_msg.sign_it.sys_id + '') == '0' ? 1 : me_msg.sign_it.sig_id;
      me_msg.sign_it.blz = blz;
      me_msg.sign_it.kunden_id = kunden_id;

      let createHNSHK = function (serverDefined) {
        let serverDefinedParam = (serverDefined === undefined) ? 1 : 2;
        let params = [
          ['PIN', me_msg.sign_it.pin_vers == '999' ? 1 : 2], me_msg.sign_it.pin_vers, 1, 1, 1, [serverDefinedParam, NULL, me_msg.sign_it.sys_id], signature_id, [1, Helper.convertDateToDFormat(new Date()), Helper.convertDateToTFormat(new Date())],
          [1, 999, 1],
          [6, 10, 16],
          [280, blz, kunden_id, 'S', 0, 0]
        ];
        return h.types.createSegment('HNSHK', 4, params);
      };

      var seg_vers, sec_profile;
      if (me_msg.proto_version == 300) {
        me_msg.addSeg(createHNSHK(me_msg.sign_it.server));
      } else {
        // TODO 220
      }
    }
  };

  me_msg.parse = function (in_txt) {
    var parser = new Parser(in_txt);

    while (parser.hasNext()) {
      var segm = new Segment();
      segm.parse(parser);
      me_msg.segments.push(segm);
      parser.nextPos();
    }

    // prüfen ob verschlüsselt war
    if (me_msg.segments.length == 4 && me_msg.segments[1].name == 'HNVSK' && me_msg.segments[2].name == 'HNVSD') {
      var first = me_msg.segments[0];
      me_msg.hnvsk = me_msg.segments[1];
      var seg_hnvsd = me_msg.segments[2];
      var last = me_msg.segments[3];
      // Neue Segmente hinzufügen
      me_msg.segments = new Array();
      me_msg.segments.push(first);
      if ((me_msg.hnvsk.vers == '3' && me_msg.hnvsk.getEl(1).getEl(1) == 'PIN') || (me_msg.hnvsk.vers == '2' && me_msg.hnvsk.getEl(1) == '998')) {
        var parser2 = new Parser(seg_hnvsd.getEl(1));
        while (parser2.hasNext()) {
          var segm2 = new Segment();
          segm2.parse(parser2);
          me_msg.segments.push(segm2);
          parser2.nextPos();
        }
      } else {
        throw new ParseError('Msg', 'Nicht unterstützte Verschlüsselungsmethode!', 0);
      }
      me_msg.segments.push(last);
    }
  };

  me_msg.transformForSend = function () {

    var body = '';

    // Signatur abschluss
    if (me_msg.sign_it) {
      // Signaturabschluss
      // Sicherheitskontrollreferenz 1 muss mit signaturkopf übereinstimmen
      // Validierungsresultat null, bleibt bei PinTan leer
      // Benutzerdefinierte Signatur [Pin,Tan], die Tan nur dann wenn durch den Geschäftsvorfall erforderlich
      if (me_msg.sign_it.server === undefined) {
        if (me_msg.sign_it.tan === NULL) {
          me_msg.addSeg(Helper.newSegFromArray('HNSHA', me_msg.proto_version == 300 ? 2 : 1, [1, NULL, [me_msg.sign_it.pin]]));
        } else {
          me_msg.addSeg(Helper.newSegFromArray('HNSHA', me_msg.proto_version == 300 ? 2 : 1, [1, NULL, [me_msg.sign_it.pin, me_msg.sign_it.tan]]));
        }
      } else {
        me_msg.addSeg(Helper.newSegFromArray('HNSHA', 2, [2]));
      }
    }

    me_msg.segments.map(function (s) {
      body += s.transformForSend();
    });

    // Letztes segment erstellen
    if (me_msg.sign_it) {
      // in body ist der eigentliche body der dann aber jetzt neu erstellt wird
      // Verschlüsselung
      // 1. HNVSK                                     HNVSK:998:3
      // Sicherheitsprofil                            [PIN:1]
      // Sicherheitsfunktion, kodiert                 998 // bleibt immer so unabhängig von der der tatsächlichen Funktion
      // Rolle des Sicherheits-lieferanten, kodiert   1
      // Sicherheitsidentifikation, Details           [1.null.0]
      // Sicherheitsdatum und -uhrzeit                [1,20141216,205751]
      // Verschlüsselungs-algorithmus                 [2,2,13,@8@,5,1]
      // Schlüsselname                                [280:12345678:max:V:0:0]
      //      Ctry Code                               280 (hier fest)
      //      BLZ
      //      benutzer
      //      Schlüsselart                            V Chiffrierschlüssel
      //      Schlüsselnummer                         0
      //      Schlüsselversion                        0
      // Komprimierungsfunktion                       0
      // Zertifikat                                   leer hier
      // +998+1+1::0+1:20141216:205751+2:2:13:@8@:5:1+280:12345678:max:V:0:0+0'
      if (me_msg.proto_version == 300) {
        let segmentHNVSK = {
          name: 'HNVSK',
          version: 3,
          params: [
            ['PIN', me_msg.sign_it.pin_vers == '999' ? 1 : 2], 998, 1, [1, NULL, me_msg.sign_it.sys_id],
            [1, Helper.convertDateToDFormat(new Date()), Helper.convertDateToTFormat(new Date())],
            [2, 2, 13, Helper.Byte('\0\0\0\0\0\0\0\0'), 5, 1],
            [280, me_msg.sign_it.blz, me_msg.sign_it.kunden_id, 'V', 0, 0], 0
          ]
        };

        me_msg.hnvsk = h.types.createSegment(segmentHNVSK.name, segmentHNVSK.version, segmentHNVSK.params);
      } else {
        // TODO 220
      }
      me_msg.hnvsk.nr = 998;
      var seg_hnvsd = h.types.createSegment('HNVSD', 1, [Helper.Byte(body)]);
      seg_hnvsd.nr = 999;
      body = me_msg.hnvsk.transformForSend();
      body += seg_hnvsd.transformForSend();
    }

    // Abschließen
    var seg = h.types.createSegment('HNHBS', 1, [me_msg.msg_nr]);
    me_msg.addSeg(seg);
    body += seg.transformForSend();
    var top = me_msg.segments[0].transformForSend();
    me_msg.segments[0].store.data[0] = h.padWithZero(top.length + body.length);
    //top = me_msg.segments[0].transformForSend();
    return top + body;
  };

  me_msg.addSeg = function (seg) {
    seg.nr = me_msg.segments_ctr + 1;
    me_msg.segments[me_msg.segments_ctr] = seg;
    me_msg.segments_ctr++;
    return seg.nr;
  };

  me_msg.isSigned = function () {
    return me_msg.selectSegByName('HNSHK').length === 1;
  };

  me_msg.selectSegByName = function (name) {
    return me_msg.segments.filter(s => s.name === name);
  };

  me_msg.selectSegByBelongTo = function (belong_to) {
    return me_msg.segments.filter(s => s.bez === (belong_to + ''));
  };

  me_msg.selectSegByNameAndBelongTo = function (name, belong_to) {
    return me_msg.segments.filter(s => s.name === name && s.bez === (belong_to + ''));
  };

};

module.exports = message;