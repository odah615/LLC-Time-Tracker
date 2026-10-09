import { User } from '../types';

export const CANONICAL_EMPLOYEE_DIRECTORY: Record<string, { name: string; username: string; email: string; role: 'admin' | 'trainer' | 'agent' | 'team_lead'; designation: string }> = {
  'SUPERADMIN': { name: 'Admin', username: 'admin', email: 'admin@llc.com', role: 'admin', designation: 'Admin' },
  'LLC-0001': { name: 'Agent_Admin', username: 'agent_admin', email: 'agent_admin@llc.com', role: 'admin', designation: 'Admin' },
  'LLC-0002': { name: 'Team_Leader1', username: 'team_leader1', email: 'team_leader1@llc.com', role: 'team_lead', designation: 'Team Leader' },
  'LLC-0003': { name: 'Pia', username: 'trainer', email: 'piaodahcam@gmail.com', role: 'trainer', designation: 'Trainer' },
  'LLC-0004': { name: 'Alexa Gabrielle Bardaje', username: 'agabr', email: 'bardajealexagabrielle@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0005': { name: 'April Sam Dimaano', username: 'asamd', email: 'dimaanosam2@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0006': { name: 'Boris Andrew Villanueva', username: 'bandr', email: 'villanuevaboris@yahoo.com', role: 'agent', designation: 'Agent' },
  'LLC-0007': { name: 'Cyril Diola Garcia', username: 'cdiol', email: 'cyrilgarcia112814@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0008': { name: 'Daina Yanez', username: 'dyane', email: 'dama.yanez.coc@phinmaed.com', role: 'agent', designation: 'Agent' },
  'LLC-0009': { name: 'Fatima Dence David', username: 'fdenc', email: 'dencedavid20@icloud.com', role: 'agent', designation: 'Agent' },
  'LLC-0010': { name: 'Gerald A. Salvador', username: 'gasal', email: 'salvadorged898@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0011': { name: 'Jayson Cariaga', username: 'jcari', email: 'nabojayson154@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0012': { name: 'Jenalyn Nueva', username: 'jnuev', email: 'jenalyn.nueva9245@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0013': { name: 'Kathleen Ann L. Totaan', username: 'kannl', email: 'kathleen.totaan4@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0014': { name: 'Lourdes Mary Cenina', username: 'lmary', email: 'lourdescenina@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0015': { name: 'Luis David Ramirez', username: 'ldavi', email: 'ramirezluisdavid0312@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0016': { name: 'Maria Racquel Gracia M. Libarios', username: 'mracq', email: 'racquellibarios97@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0017': { name: 'Mark Jesus A. Egoy', username: 'mjesu', email: 'markjesusegoy@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0018': { name: 'Raquel Guiapal', username: 'rguia', email: 'kayefam25@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0019': { name: 'Ron Louie Logan', username: 'rloui', email: 'yeyesylogan5@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0020': { name: 'Rubilyne Barrameda', username: 'rbarr', email: 'brubilyne@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0021': { name: 'Shiela Romey', username: 'srome', email: 'mizfeb@hotmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0022': { name: 'Trixy Ashley Decena Mabutol', username: 'tashl', email: 'trixdecena@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0023': { name: 'Juan David', username: 'jdavid', email: 'jdavid@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0024': { name: 'Carl', username: 'carl', email: 'carl@llc.com', role: 'team_lead', designation: 'Team Leader' },
  'LLC-0025': { name: 'Lyanne', username: 'lyanne', email: 'lyanne@llc.com', role: 'team_lead', designation: 'Team Leader' },
  'LLC-0026': { name: 'Allen', username: 'allen', email: 'allen@llc.com', role: 'team_lead', designation: 'Team Leader' },
  'LLC-0027': { name: 'Bryan', username: 'bryan', email: 'bryan@llc.com', role: 'team_lead', designation: 'Team Leader' },
  'LLC-0028': { name: 'Test Agent', username: 'testagent', email: 'testagent@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0029': { name: 'Kyra', username: 'kyra', email: 'kyra@llc.com', role: 'team_lead', designation: 'Team Leader' },
  'LLC-0030': { name: 'Hosen', username: 'hosen', email: 'hosen@llc.com', role: 'team_lead', designation: 'Team Leader' },
  'LLC-0031': { name: 'Danah', username: 'danah', email: 'danah@llc.com', role: 'team_lead', designation: 'Team Leader' },
  'LLC-0032': { name: 'Miko Carmel', username: 'mcarm', email: 'miko@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0033': { name: 'Jocelyn Enriquez', username: 'jenri', email: 'jocelyn@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0034': { name: 'Omar Apolinario', username: 'oapol', email: 'omar@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0035': { name: 'John Gabriel Pai', username: 'jgpai', email: 'john@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0036': { name: 'Amy Janine Pedrito', username: 'ajped', email: 'amy@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0037': { name: 'Nicole Alcantara', username: 'nalca', email: 'nicole@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0038': { name: 'Chessa Mae Ful', username: 'cmful', email: 'chessa@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0039': { name: 'Myra Balatbat', username: 'mbala', email: 'myra@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0040': { name: 'John Cedric San', username: 'jcsan', email: 'cedric@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0041': { name: 'Jhureza Lazo', username: 'jlazo', email: 'jhureza@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0042': { name: 'Orpha Percy', username: 'operc', email: 'orpha@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0043': { name: 'Judy', username: 'judy', email: 'judy@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0044': { name: 'Ann Abad', username: 'aabad', email: 'ann@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0045': { name: 'Aiza Gonzales', username: 'agall', email: 'aiza@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0049': { name: 'Paolo Leanillo', username: 'plean', email: 'paolo@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0052': { name: 'Gley Alday', username: 'galday0', email: 'glecy@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0053': { name: 'Paul Jeffrey Bulosan', username: 'pjbul', email: 'paul@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0055': { name: 'Mae Frances', username: 'mfrances', email: 'mae@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0056': { name: 'Leslie Timog', username: 'ltimog', email: 'leslie@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0057': { name: 'Almark Debuque', username: 'adebuque', email: 'almark@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0058': { name: 'John Calvin Natividad', username: 'jnatividad', email: 'calvin@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0059': { name: 'Queenie Mae Engbino', username: 'qengbino', email: 'queen@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0060': { name: 'Justine Hiceta', username: 'jhice', email: 'justine@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0061': { name: 'Patricia Elizon', username: 'pelizon', email: 'patricia@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0062': { name: 'Annalyn Alforque', username: 'aalforque', email: 'annalyn@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0063': { name: 'Beinalyn Dianala', username: 'bdian', email: 'beinalyn@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0064': { name: 'Deny Datiles', username: 'ddatiles', email: 'deny@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0065': { name: 'Jean Cristine Serdea', username: 'jserdea', email: 'jean@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0066': { name: 'Patrick Guardian', username: 'pguardian', email: 'patrick@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0069': { name: 'Princess Nicole Regala', username: 'pregala', email: 'tenorioprincessmay@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0070': { name: 'Rodolfo Peralta Jr', username: 'rjr', email: 'thirdyperalta15@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0071': { name: 'Princess Loto', username: 'ploto', email: 'princess.loto.v1@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0072': { name: 'Mechill Barredo', username: 'mbarredo', email: 'mechill.barredo@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0073': { name: 'Ejay Suaze', username: 'esuaze', email: 'ejaysuaze1@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0074': { name: 'Marvin Garcia', username: 'mgarcia', email: 'marvinricasagarcia@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0075': { name: 'Rexcell Remocaldo', username: 'rremocaldo', email: 'rexcell.remocaldo@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0076': { name: 'Kristeen Liquit', username: 'kliquit', email: 'liquitk@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0077': { name: 'Ma. Fedelyn Rapiz', username: 'mrapiz', email: 'fhedrapiz@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0078': { name: 'Maria Paula Nabo', username: 'mnabo', email: 'recca0929@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0079': { name: 'Moneque Belarmino', username: 'mbelarmino', email: 'monequea13@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0080': { name: 'Rain Machado', username: 'rmachado', email: 'machado.raingel@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0081': { name: 'Suzette Apordo', username: 'sapordo', email: 'apordosuzette@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0082': { name: 'Geraldine Grajo', username: 'ggrajo', email: 'geraldinegrajo89@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0083': { name: 'Jasmine Joyce Lucena', username: 'jlucena', email: 'jasmine.lucena5@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0084': { name: 'Mike Rapiz', username: 'mrapiz1', email: 'mikerapiz@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0085': { name: 'Princess Yara Mustapha', username: 'pmustapha', email: 'kimprincessyaramustapha@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0086': { name: 'Gracious Yvonne Batarra', username: 'gbatarra', email: 'graciousyvonne1997@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0087': { name: 'Miya Pearl Pricas', username: 'mpricas', email: 'miyaka01234@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0088': { name: 'Jera Mae Millan', username: 'jmillan', email: 'maemillan98@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0089': { name: 'Charie Ceniza', username: 'cceniza', email: 'pardillocharie@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0090': { name: 'Jeramil Vegilla', username: 'jvegilla', email: 'vegillajeramil@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0091': { name: 'Julius Cabrera', username: 'jcabrera', email: 'juliuscabreraa@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0092': { name: 'Aubrey Dela Cruz', username: 'acruz', email: 'aubrey@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0093': { name: 'Ayessa Balondo', username: 'abalondo', email: 'ayessa@llc.com', role: 'agent', designation: 'Agent' },
  'PBULOSAN': { name: 'Paul Jeffrey Bulosan', username: 'pbulosan', email: 'pbulosan@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0101': { name: 'Junaisa Dianne Ramos', username: 'jramos0', email: 'ramonagab95@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0102': { name: 'Jessa Fuentes', username: 'jfuentes', email: 'jessa@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0103': { name: 'Rowena Vegilla', username: 'rvegilla', email: 'rowena@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0104': { name: 'Toni Mitchell Villoso', username: 'tvilloso', email: 'toni@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0105': { name: 'Y. Obiedo', username: 'yobiedo', email: 'yobiedo@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0106': { name: 'Camille', username: 'camille', email: 'camille@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0107': { name: 'Juan Carlo Yamzon', username: 'jyamzon', email: 'jcyamzon@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0108': { name: 'Kris Simpson', username: 'ksimpson', email: 'kristialauricesimpson@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0109': { name: 'Esperanza Bacalla', username: 'ebacalla', email: 'esperanza.bacalla@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0110': { name: 'Albert Monfero', username: 'amonfero', email: 'albertmonfero@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0111': { name: 'Rochelle Ebit', username: 'rebit', email: 'tonyroche172013@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0112': { name: 'Irish Jane Paz', username: 'ipaz', email: 'irishpaz46@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0113': { name: 'Jessica Algones', username: 'jalgones', email: 'jalgones84@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0114': { name: 'Chamille Enriquez', username: 'cenriquez', email: 'chamille@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0115': { name: 'Maria Leatrice Laderas', username: 'mladeras', email: 'maleatrice@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0116': { name: 'Michellenie Mae Yntela', username: 'myntela', email: 'michellenie@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0120': { name: 'Niña Carmella Domingo', username: 'ndomingo', email: 'nina@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0121': { name: 'Ayra Erika Sy', username: 'asy', email: 'Erihkasy16@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0122': { name: 'Bian Labares Maglangit', username: 'bmaglangit', email: 'bianmaglangit2001@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0123': { name: 'Cedena Amor Rodriguez', username: 'crodriguez', email: 'cedenamorodriguez04@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0124': { name: 'Cenbert Domingo', username: 'cdomingo', email: 'cenbretdomingo@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0125': { name: 'Frangelo Dela Cruz', username: 'fcruz', email: 'frangelodelacruz1@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0126': { name: 'Jay-R B. Ventura', username: 'jventura', email: 'jhekjhek2086@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0127': { name: 'Joarah Marie Octavio', username: 'joctavio', email: 'jhoarahmarie16@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0128': { name: 'John Vincent Flores', username: 'jflores', email: 'jvflores1234567@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0129': { name: 'J. Perez', username: 'jperez', email: 'jperez@llc.com', role: 'agent', designation: 'Agent' },
  'LLC-0130': { name: 'Mark Anthony E. Gonzales', username: 'mgonzales', email: 'tristanwakka@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0131': { name: 'Michael A. Custodio', username: 'mcustodio', email: 'michaelacustodio@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0132': { name: 'Eugene Munda', username: 'emunda', email: 'mundaeugene0@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0133': { name: 'Nhel Singson', username: 'nsingson', email: 'cle0nhel2019@gmail.com', role: 'agent', designation: 'Agent' },
  'LLC-0135': { name: 'Riza Mae B. Oliva', username: 'roliva', email: 'rizamaeoliva10@gmail.com', role: 'agent', designation: 'Agent' },
};

/**
 * Resolves a user's canonical Full Name and verified details by checking
 * employee code, username, ID, or email against the authoritative roster.
 */
export const resolveCanonicalEmployee = (input?: {
  employeeCode?: string;
  name?: string;
  username?: string;
  email?: string;
  id?: string;
} | string | null): { code: string; name: string; username: string; email: string; role: 'admin' | 'trainer' | 'agent' | 'team_lead'; designation: string } | null => {
  if (!input) return null;

  let rawCode = '';
  let rawUser = '';
  let rawName = '';
  let rawEmail = '';
  let rawId = '';

  if (typeof input === 'string') {
    const s = input.trim();
    if (/^LLC[-_]?\d+/i.test(s)) {
      rawCode = s.toUpperCase();
    } else if (s.includes('@')) {
      rawEmail = s.toLowerCase();
    } else {
      rawUser = s.toLowerCase();
      rawName = s;
      rawId = s.toLowerCase();
    }
  } else {
    rawCode = (input.employeeCode || '').toUpperCase().trim();
    rawUser = (input.username || '').toLowerCase().trim();
    rawName = (input.name || '').toLowerCase().trim();
    rawEmail = (input.email || '').toLowerCase().trim();
    rawId = (input.id || '').toLowerCase().trim();
  }

  const numCode = rawCode.replace(/^[A-Z\-_]+/, '');

  // Specific alias mappings for username/email typos or variations
  const ALIAS_MAP: Record<string, string> = {
    'pdelin': 'LLC-0003',
    'bmaglangiy2001': 'LLC-0122',
    'bmaglangiy2': 'LLC-0122',
    'bmaglangit2001': 'LLC-0122',
    'jperez': 'LLC-0129',
    // Aliases for agent usernames/surnames
    'apedrito': 'LLC-0036',
    'ajped': 'LLC-0036',
    'pedrito': 'LLC-0036',
    'cfulgencio': 'LLC-0038',
    'cmful': 'LLC-0038',
    'fulgencio': 'LLC-0038',
    'jsantiago': 'LLC-0040',
    'jcsan': 'LLC-0040',
    'santiago': 'LLC-0040',
    'agonzales': 'LLC-0045',
    'agall': 'LLC-0045',
    'gonzales': 'LLC-0045',
    'liquitk': 'LLC-0076',
    'kliquit': 'LLC-0076',
    'liquit': 'LLC-0076',
    'emcalexander': 'LLC-0100',
    'mcalexander': 'LLC-0100',
    'jdramos': 'LLC-0101',
    'jdramos120': 'LLC-0101',
    'jramos0': 'LLC-0101',
    'pramos': 'LLC-0098',
    'jcyamzon': 'LLC-0107',
    'jcyamzon0118': 'LLC-0107',
    'jyamzon': 'LLC-0107',
    'yamzon': 'LLC-0107',
    'pbulosan': 'LLC-0053',
    'pjbul': 'LLC-0053',
    'bulosan': 'LLC-0053',
  };

  const aliasTarget = ALIAS_MAP[rawUser] || ALIAS_MAP[rawCode.toLowerCase()] || ALIAS_MAP[rawEmail.split('@')[0]];
  if (aliasTarget && CANONICAL_EMPLOYEE_DIRECTORY[aliasTarget]) {
    return { code: aliasTarget, ...CANONICAL_EMPLOYEE_DIRECTORY[aliasTarget] };
  }

  for (const [code, info] of Object.entries(CANONICAL_EMPLOYEE_DIRECTORY)) {
    const infoNum = code.replace(/^[A-Z\-_]+/, '');
    const codeMatch = (rawCode && rawCode === code) || (numCode && infoNum && numCode === infoNum);
    const userMatch = rawUser && rawUser === info.username.toLowerCase();
    const nameMatch = rawName && (rawName === info.name.toLowerCase() || rawName.includes(info.name.toLowerCase()) || info.name.toLowerCase().includes(rawName));
    const emailMatch = rawEmail && rawEmail === info.email.toLowerCase();
    const idMatch = rawId && (rawId.includes(code.toLowerCase()) || rawId.includes(info.username.toLowerCase()));

    if (codeMatch || userMatch || nameMatch || emailMatch || idMatch) {
      return { code, ...info };
    }
  }

  // Token matching for names or surnames (e.g. "pedrito" in "Amy Janine Pedrito", "mcalexander" in "Ernest McAlexander")
  const rawTokens = [rawUser, rawCode.toLowerCase(), rawName].filter(Boolean);
  for (const [code, info] of Object.entries(CANONICAL_EMPLOYEE_DIRECTORY)) {
    const nameLower = info.name.toLowerCase();
    const nameParts = nameLower.split(/\s+/);
    for (const tok of rawTokens) {
      if (tok.length >= 4 && (nameLower.includes(tok) || nameParts.some((p) => p === tok || p.startsWith(tok) || tok.startsWith(p)))) {
        return { code, ...info };
      }
    }
  }

  // Safe fallback ONLY if input already carries a valid LLC format or numeric code
  if (numCode && /^LLC[-_]?\d+/i.test(rawCode)) {
    const cleanCode = `LLC-${numCode.padStart(4, '0')}`;
    const cleanName = rawName || rawUser || cleanCode;
    const cleanUser = rawUser || cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return {
      code: cleanCode,
      name: cleanName,
      username: cleanUser,
      email: rawEmail || `${cleanUser}@llctimetracker.com`,
      role: 'agent',
      designation: 'Agent',
    };
  }

  return null;
};

/**
 * Generates a clean, unique username from an employee name.
 * e.g. "Alexa Gabrielle Bardaje" -> "abardaje"
 */
export const generateUniqueUsername = (
  name: string,
  existingUsers: User[] = [],
  excludeUserId?: string
): string => {
  if (!name || !name.trim()) return `user${Math.floor(1000 + Math.random() * 9000)}`;

  const clean = name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const parts = clean.split(/\s+/).filter(Boolean);

  let base = '';
  if (parts.length === 1) {
    base = parts[0];
  } else if (parts.length >= 2) {
    base = `${parts[0][0]}${parts[parts.length - 1]}`;
  } else {
    base = 'user';
  }

  const takenUsernames = new Set(
    existingUsers
      .filter((u) => !excludeUserId || u.id !== excludeUserId)
      .map((u) => (u.username || '').toLowerCase().trim())
      .filter(Boolean)
  );

  let candidate = base;
  let counter = 1;
  while (takenUsernames.has(candidate)) {
    candidate = `${base}${counter}`;
    counter++;
  }

  return candidate;
};

/**
 * Checks if an employee name or username is a placeholder/dummy name
 * such as Agent_1, Agent 2, Agent_Admin, Team_Leader1, Trainee 1, etc.
 */
export const isPlaceholderName = (name?: string, username?: string, employeeCode?: string): boolean => {
  if (!name && !username) return true;
  const cleanName = (name || '').trim();
  const cleanUser = (username || '').trim();
  const cleanCode = (employeeCode || '').trim().toUpperCase();

  // Explicit legacy dummy accounts
  if (
    cleanName.toLowerCase() === 'agent_admin' ||
    cleanName.toLowerCase() === 'agent admin' ||
    cleanName.toLowerCase() === 'team_leader1' ||
    cleanName.toLowerCase() === 'team leader 1' ||
    cleanUser.toLowerCase() === 'agentadm' ||
    cleanUser.toLowerCase() === 'teamlead' ||
    cleanCode === 'LLC-0001' ||
    cleanCode === 'LLC-0002'
  ) {
    return true;
  }

  const isGenericAgent = /^Agent[_\s\-]?\d+$/i.test(cleanName) || /^Agent[_\s\-]?\d+$/i.test(cleanUser);
  const isGenericTrainee = /^Trainee[_\s\-]?\d+$/i.test(cleanName) || /^Trainee[_\s\-]?\d+$/i.test(cleanUser);
  const isGenericEmployee = /^Employee[_\s\-]?\d+$/i.test(cleanName) || /^Employee[_\s\-]?LLC/i.test(cleanName);
  const isGenericUser = /^User[_\s\-]?\d+$/i.test(cleanName);

  return isGenericAgent || isGenericTrainee || isGenericEmployee || isGenericUser;
};

/**
 * Universally deduplicates and purges redundant/dummy users by:
 * 1. Normalizing SuperAdmin to usr-superadmin-red
 * 2. Normalizing Trainer (Pia / LLC-0003) to usr-llc-0003
 * 3. Matching trainees & staff by Full Name, Employee Code, Email, or ID
 * 4. Discarding placeholder junk accounts (Agent 1, Agent 2, Agent_Admin, Team_Leader1)
 * 5. Merging duplicate records into a single authoritative record.
 */
export const deduplicateUsers = (rawUsers: User[]): User[] => {
  if (!Array.isArray(rawUsers) || rawUsers.length === 0) return [];

  const nameMap = new Map<string, number>();
  const codeMap = new Map<string, number>();
  const numCodeMap = new Map<string, number>();
  const emailMap = new Map<string, number>();
  const userMap = new Map<string, number>();
  const idMap = new Map<string, number>();
  const result: User[] = [];

  for (const u of rawUsers) {
    if (!u) continue;

    // Check if SuperAdmin
    const isSuperAdmin =
      u.employeeCode?.toLowerCase() === 'superadmin' ||
      u.id === 'usr-superadmin-red' ||
      u.id === 'usr-superadmin-root' ||
      u.email?.toLowerCase() === 'admin@llc.com' ||
      (u.role === 'admin' && (u.name === 'Admin' || u.name === 'Red'));

    if (isSuperAdmin) {
      const existingAdminIdx = result.findIndex(
        (x) => x.employeeCode?.toLowerCase() === 'superadmin' || x.id === 'usr-superadmin-red'
      );
      const canonicalAdmin: User = {
        ...u,
        id: 'usr-superadmin-red',
        employeeCode: 'SuperAdmin',
        email: 'admin@llc.com',
        name: u.name === 'Red' ? 'Red' : 'Admin',
        role: 'admin',
        designation: 'Admin',
        username: u.username || 'admin',
        geoTimezone: u.geoTimezone || 'Asia/Manila',
        geoCity: u.geoCity || 'Manila, Philippines',
        password: u.password || 'AdminpassW0rd123!',
      };
      if (existingAdminIdx >= 0) {
        result[existingAdminIdx] = { ...result[existingAdminIdx], ...canonicalAdmin };
      } else {
        result.unshift(canonicalAdmin);
      }
      continue;
    }

    // Check if Trainer (Pia / LLC-0003)
    const isTrainer =
      u.employeeCode?.toUpperCase() === 'LLC-0003' ||
      u.email?.toLowerCase() === 'piaodahcam@gmail.com' ||
      u.id === 'usr-llc-0003' ||
      u.name?.toLowerCase().trim() === 'pia' ||
      (u.designation?.toLowerCase().includes('trainer') && u.role === 'trainer');

    if (isTrainer) {
      const existingTrainerIdx = result.findIndex(
        (x) =>
          x.employeeCode?.toUpperCase() === 'LLC-0003' ||
          x.email?.toLowerCase() === 'piaodahcam@gmail.com' ||
          x.id === 'usr-llc-0003' ||
          x.name?.toLowerCase().trim() === 'pia'
      );
      const canonicalTrainer: User = {
        ...u,
        id: 'usr-llc-0003',
        employeeCode: 'LLC-0003',
        email: 'piaodahcam@gmail.com',
        name: 'Pia',
        role: 'trainer',
        designation: 'Trainer',
        username: 'trainer',
        department: 'Training',
        geoTimezone: u.geoTimezone || 'Asia/Manila',
        geoCity: u.geoCity || 'Manila, Philippines',
      };
      if (existingTrainerIdx >= 0) {
        result[existingTrainerIdx] = { ...result[existingTrainerIdx], ...canonicalTrainer };
      } else {
        result.push(canonicalTrainer);
      }
      continue;
    }

    // Filter out dummy test placeholders (Agent_Admin, Team_Leader1, Agent 1, Agent 2, Trainee 1, etc.)
    if (isPlaceholderName(u.name, u.username, u.employeeCode)) {
      continue;
    }

    // Auto-heal with canonical profile if available
    const canonical = resolveCanonicalEmployee(u);
    let effectiveUser: User = { ...u };
    if (canonical) {
      effectiveUser = {
        ...effectiveUser,
        name: canonical.name, // Guaranteed full employee name (e.g. Alexa Gabrielle Bardaje)
        username: canonical.username, // Guaranteed username (e.g. agabr)
        employeeCode: canonical.code, // Guaranteed code (e.g. LLC-0004)
        email: canonical.email || effectiveUser.email,
        role: canonical.role || effectiveUser.role,
        designation: canonical.designation || effectiveUser.designation || 'Agent',
      };
    }

    const normName = (effectiveUser.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normCode = (effectiveUser.employeeCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    const numOnlyCode = normCode.replace(/^[A-Z]+/, '');
    const normEmail = (effectiveUser.email || '').toLowerCase().trim();
    const normUsername = (effectiveUser.username || '').toLowerCase().trim();
    const rawId = (effectiveUser.id || '').trim();

    // Check if matching user already exists in result
    let existingIndex = -1;
    if (normCode && codeMap.has(normCode)) {
      existingIndex = codeMap.get(normCode)!;
    } else if (numOnlyCode && numCodeMap.has(numOnlyCode)) {
      existingIndex = numCodeMap.get(numOnlyCode)!;
    } else if (normUsername && userMap.has(normUsername)) {
      existingIndex = userMap.get(normUsername)!;
    } else if (normEmail && emailMap.has(normEmail)) {
      existingIndex = emailMap.get(normEmail)!;
    } else if (normName && nameMap.has(normName)) {
      existingIndex = nameMap.get(normName)!;
    } else if (rawId && idMap.has(rawId)) {
      existingIndex = idMap.get(rawId)!;
    }

    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      const existingCanon = resolveCanonicalEmployee(existing);
      const chosenName = canonical?.name || existingCanon?.name || (effectiveUser.name && effectiveUser.name !== effectiveUser.username ? effectiveUser.name : existing.name);
      const chosenUsername = canonical?.username || existingCanon?.username || effectiveUser.username || existing.username;
      const chosenCode = canonical?.code || existingCanon?.code || effectiveUser.employeeCode || existing.employeeCode;

      // Preserve the authoritative credential state when merging duplicates.
// A real existing password must never be replaced by Password123!,
// and an existing mustChangePassword=false must never be turned back on
// just because a duplicate/imported record has the default state.
const existingHasRealPassword =
  !!existing.password &&
  existing.password.trim() !== '' &&
  existing.password !== 'Password123!';

const incomingHasRealPassword =
  !!effectiveUser.password &&
  effectiveUser.password.trim() !== '' &&
  effectiveUser.password !== 'Password123!';

const merged: User = {
  ...existing,
  ...effectiveUser,

  // Canonical identity
  name: chosenName,
  employeeCode: chosenCode,
  username: chosenUsername,
  email: canonical?.email || existing.email || effectiveUser.email,

  // Preserve authoritative role/profile information
  role:
    existing.role && existing.role !== 'agent'
      ? existing.role
      : (effectiveUser.role || 'agent'),

  designation:
    existing.designation || effectiveUser.designation || 'Agent',

  department:
    existing.department || effectiveUser.department || 'Operations',

  teamLeaderId:
    existing.teamLeaderId ||
    effectiveUser.teamLeaderId ||
    'usr-llc-0003',

  // NEVER replace a real password with the default password
  password:
    existingHasRealPassword
      ? existing.password
      : incomingHasRealPassword
        ? effectiveUser.password
        : 'Password123!',

  // Preserve an existing explicit password-change state.
  // Only use the incoming value when the existing record has no value.
mustChangePassword:
  existingHasRealPassword
    ? false
    : effectiveUser.mustChangePassword !== undefined
      ? effectiveUser.mustChangePassword
      : (existing.mustChangePassword ?? true),

  customPermissions:
    existing.customPermissions || effectiveUser.customPermissions,

  avatar:
    existing.avatar || effectiveUser.avatar,
};

      result[existingIndex] = merged;

      // Refresh all identity maps so subsequent duplicate records
// resolve to this same canonical user.
const mergedName = (merged.name || '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '')
  .trim();

const mergedCode = (merged.employeeCode || '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '')
  .trim();

const mergedNumCode = mergedCode.replace(/^[A-Z]+/, '');

const mergedEmail = (merged.email || '').toLowerCase().trim();
const mergedUsername = (merged.username || '').toLowerCase().trim();
const mergedId = (merged.id || '').trim();

if (mergedName) nameMap.set(mergedName, existingIndex);
if (mergedCode) codeMap.set(mergedCode, existingIndex);
if (mergedNumCode) numCodeMap.set(mergedNumCode, existingIndex);
if (mergedEmail) emailMap.set(mergedEmail, existingIndex);
if (mergedUsername) userMap.set(mergedUsername, existingIndex);
if (mergedId) idMap.set(mergedId, existingIndex);

    } else {
      const newIndex = result.length;
      result.push(effectiveUser);
      if (normName) nameMap.set(normName, newIndex);
      if (normCode) codeMap.set(normCode, newIndex);
      if (numOnlyCode) numCodeMap.set(numOnlyCode, newIndex);
      if (normEmail) emailMap.set(normEmail, newIndex);
      if (normUsername) userMap.set(normUsername, newIndex);
      if (rawId) idMap.set(rawId, newIndex);
    }
  }

  return result;
};
