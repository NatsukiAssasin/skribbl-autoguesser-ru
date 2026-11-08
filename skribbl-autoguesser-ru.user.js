// ==UserScript==
// @name         Skribbl AutoGuesser RU+EN
// @name:ru      Skribbl Автоугадыватель (RU+EN)
// @namespace    http://tampermonkey.net/
// @version      3.2-ru
// @description  Skribbl.io helper: word suggestions (RU+EN) with word colors, word search, wordlists from GitHub, AI that looks at the drawing (Google Gemini free key by default).
// @description:ru Помощник для Skribbl.io: подсказки слов (RU+EN), цвета слов, поиск слов, словари с GitHub, ИИ по рисунку (по умолчанию бесплатный ключ Google Gemini).
// @match        https://skribbl.io/*
// @icon         https://skribbl.io/favicon.png
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      generativelanguage.googleapis.com
// @connect      api.anthropic.com
// @license      MIT
// ==/UserScript==

(function() {
"use strict";

// ======================= НАСТРОЙКИ =======================
// Защита от "Spam detected": минимум столько мс между отправками слов кнопками
const MIN_GUESS_INTERVAL = 1200;   // значение по умолчанию; меняется в меню

// Словари с GitHub (по одному слову в строке). Скачиваются при запуске и сохраняются в браузере,
// так что после первой удачной загрузки скрипт работает и без GitHub.
const RU_WORDLIST_URLS = [
    "https://raw.githubusercontent.com/NatsukiAssasin/skribbl-autoguesser-ru/refs/heads/main/wordlistRu.txt",
];
const ENABLE_ENGLISH = true;
const EN_WORDLIST_URL = "https://raw.githubusercontent.com/zkisaboss/skribbl-autoguesser/main/wordlist_test.txt";

// ИИ по рисунку. По умолчанию Google Gemini (бесплатный ключ). Только ключ вида sk-ant-... считается ключом Claude.
const PROVIDERS = {
    gemini: {
        name: "Gemini",
        autoInterval: 12000,   // у бесплатного тарифа мало запросов в минуту
        models: [
            { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (больше запросов)" },
            { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
            { id: "gemini-3.8-flash",      label: "Gemini 3.8 Flash (точнее, мало запросов)" },
        ],
    },
    anthropic: {
        name: "Claude",
        autoInterval: 8000,
        models: [
            { id: "claude-haiku-5-5",  label: "Claude Haiku 5.5 (дёшево)" },
            { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (точнее)" },
            { id: "claude-opus-5-5",   label: "Claude Opus 5.5 (дорого)" },
        ],
    },
};
const AI_MAX_CANDIDATES = 600;   // сколько слов-кандидатов отправлять ИИ
const MAX_RENDER = 300;          // сколько кнопок со словами рисовать
const MAX_SEARCH = 80;           // сколько результатов поиска показывать

// Буквы, которые может скрывать "_" в подсказке
const LETTER_CLASS = "[a-zа-яе]";

// ё и е считаем одной буквой
const norm = s => s.replace(/ё/g, "е");
const isCyr = s => /[а-яё]/i.test(s);


// ======================= ЦВЕТА СЛОВ =======================
// Цвет слова: банан - жёлтый, огурец - зелёный и т.д. Можно дописывать свои слова в списки ниже.
const COLOR_DATA = `
red: яблоко, помидор, клубника, вишня, малина, арбуз, роза, сердце, кровь, пожарная машина, пожарный гидрант, огнетушитель, кетчуп, перец чили, чили, омар, краб, мак, тюльпан, рубин, клюква, редиска, свекла, кирпич, кирпичная стена, помада, огонь, пламя, ярость, дьявол, демон, сатана, санта, божья коровка, знак стоп, стоп, марио, человек-паук, дэдпул, железный человек, красная панда, красный, пепперони, бекон, гранат, ожог, рана, шрам, укол, разбитое сердце, купидон, любовь, поцелуй, губы, кока-кола, кола, макдоналдс, кфс, тако белл, пицца хат, пожарный, скорая помощь, сирена, красная дорожка, красное море, рак, речной рак, ролл с омаром, острый соус, сальса, сердитый, злой, гнев, вулкан, коррида, брусника, земляника, паприка, ютуб, ютубер, нетфликс, нинтендо, борщ, красная шапочка, чудо-женщина, пожарная часть, пожарная сигнализация, пожарный шланг, дятел, кардинал, томат, красный кирпич, red, kfc, rage, burn, rose, mean, scar, beet, fire, love, stop, cola, crab, lips, ruby, kiss, chile, wound, chili, heart, mario, santa, blood, demon, brick, poppy, satan, salsa, siren, devil, angry, cupid, tulip, blaze, apple, bacon, radish, cancer, tomato, cherry, youtube, ketchup, volcano, netflix, ladybug, red sea, corrida, fireman, lobster, youtuber, deadpool, crayfish, nintendo, lipstick, iron man, raspberry, taco bell, hot sauce, stop sign, mcdonalds, cranberry, red panda, pizza hut, ambulance, injection, firehouse, spiderman, fire hose, pepperoni, coca cola, fire truck, woodpecker, fire alarm, watermelon, strawberry, red carpet, brick wall, firefighter, pomegranate, wonder woman, fire hydrant, broken heart, lobster roll, fire extinguisher
orange: апельсин, мандарин, морковь, тыква, тыква на хэллоуин, лиса, тигр, абрикос, хурма, папайя, манго, лосось, рыба-клоун, костер, лава, магма, закат, орангутан, морковный торт, огненный шар, оранжевый, персик, морская звезда, спасательный круг, конус, ржавчина, оранжевая, кенгуру, фанта, амазон, читос, доритос, файрфокс, пицца, апельсиновый, огненный, мандариновый, fox, cone, lava, peach, fanta, mango, magma, tiger, pizza, gourd, carrot, orange, papaya, salmon, firefox, pumpkin, apricot, doritos, cheetos, starfish, campfire, kangaroo, fireball, tangerine, life buoy, orangutan, clownfish, carrot cake, jack-o-lantern
yellow: банан, лимон, цыпленок, солнце, подсолнух, сыр, мед, кукуруза, кукурузное поле, кукурузный початок, ананас, груша, одуванчик, желток, песок, горчица, медовая горчица, пчела, оса, шмель, канарейка, лампочка, звезда, омлет, яичница, масло, сливочное масло, дыня, попкорн, картошка фри, картофель фри, чипсы, пикачу, спанч боб, миньон, такси, сено, тюк сена, стог, пиво, лимонад, соты, макароны, спагетти, лапша, рамен, паста, лазанья, сырная палочка, утка, молния, удар молнии, солнечный свет, солнечный, восход, свеча, жираф, леопард, гепард, ягуар, желтый, гомер симпсон, барт симпсон, гриль-сэндвич с сыром, чеддер, кукуруза в початках, бананы, смайлик, эмодзи, тортилья, картофельное пюре, лампа, фонарь, фонарик, светлячок, овсянка, хлопья, карандаш, автобус, луна, пляж, пустыня, снапчат, варио, пакман, винни-пух, твити, губка, тор, мимоза, sun, bee, oil, bus, pear, lamp, beer, corn, chip, sand, star, duck, wasp, moon, taxi, thor, yolk, beach, sunny, lemon, chips, honey, wario, melon, pasta, fries, emoji, ramen, butter, yellow, desert, banana, pacman, noodle, candle, omelet, sponge, cereal, canary, cheese, zipper, jaguar, pencil, tweety, minion, pac-man, popcorn, lantern, oatmeal, sunrise, cheetah, firefly, giraffe, mustard, leopard, lasagna, chicken, pikachu, hay bale, lemonade, snapchat, macaroni, tortilla, sunshine, spongebob, lightning, fried egg, pineapple, dandelion, cornfield, lightbulb, spaghetti, honeycomb, sunflower, flashlight, cheese stick, bart simpson, honey mustard, homer simpson, grilled cheese, corn on the cob, winnie the pooh, mashed potatoes
green: огурец, лягушка, трава, лист, лес, джунгли, кактус, брокколи, капуста, салат, салат-латук, горох, зеленый, шпинат, петрушка, укроп, лук-порей, кабачок, цуккини, авокадо, киви, лайм, крокодил, аллигатор, змея, черепаха, морская черепаха, динозавр, ящерица, хамелеон, геккон, кузнечик, гусеница, клевер, мята, бамбук, папоротник, ель, сосна, пальма, береза, плющ, мох, водоросли, болото, халк, шрек, йода, йоши, гринч, зомби, пришелец, нло, гоблин, эльф, леприкон, крипер, зеленый фонарь, артишок, оливка, сельдерей, стручковая фасоль, фасоль, бобы, базилик, гуакамоле, доллар, деньги, куст, кустарник, газонокосилка, теплица, огород, грядка, дерево, дуб, ива, клен, лоза, росток, пастбище, луг, поле, болгарский перец, перец, сад, фруктовый сад, парк, оазис, тайга, тропический лес, елка, новогодняя елка, анаконда, кобра, ти-рекс, трицератопс, стегозавр, брахиозавр, птеродактиль, жаба, кермит, попугай, волнистый попугайчик, богомол, спаржа, горошек, бобовый стебель, бонсай, листья, травинка, майнкрафт, ниндзя, зеленые бобы, спотифай, ватсап, спрайт, старбакс, андроид, луиджи, зельда, колибри, остров, зелень, лиана, oak, elf, ivy, ufo, pine, dill, park, vine, bush, bean, leaf, lime, tree, trex, yoda, moss, mint, toad, leek, peas, frog, palm, hulk, fern, kiwi, beans, money, swamp, grass, green, shrub, shrek, snake, t-rex, birch, cobra, zelda, oasis, olive, basil, alien, yoshi, gecko, luigi, algae, ninja, maple, salad, field, kermit, jungle, dollar, lizard, willow, clover, parrot, grinch, forest, pepper, squash, sprout, zombie, sprite, mantis, bonsai, celery, bamboo, meadow, goblin, cactus, turtle, island, garden, creeper, spinach, pasture, cabbage, parsley, avocado, spotify, lettuce, android, orchard, zucchini, dinosaur, tortoise, whatsapp, broccoli, anaconda, cucumber, parakeet, starbucks, alligator, minecraft, guacamole, palm tree, pine tree, chameleon, beanstalk, artichoke, crocodile, star bucks, sea turtle, lawn mower, leprechaun, rainforest, greenhouse, stegosaurus, bell pepper, caterpillar, green beans, grasshopper, pterodactyl, triceratops, hummingbird, green lantern, brachiosaurus, christmas tree
blue: небо, море, океан, вода, озеро, река, волна, кит, дельфин, синий, голубой, джинсы, айсберг, капля, капелька, дождь, соник, сапфир, черника, бассейн, водопад, аквариум, русалка, посейдон, нептун, фейсбук, твиттер, скайп, самсунг, пепси, тихий океан, атлантика, северное море, мертвое море, аквамен, джинн, дори, снежинка, сосулька, ледник, лед, лужа, душ, водяной пистолет, прилив, ливневка, ручей, родник, пруд, гейзер, акула, медуза, рыба, рыба-меч, тунец, сардины, окунь, камбала, скат, удильщик, рыба-фугу, морской конек, акваланг, гидрокостюм, яхта, лодка, корабль, парусник, катер, буксир, паром, каноэ, каяк, плот, подводная лодка, круизный лайнер, пиратский корабль, кораблекрушение, льдина, подледная рыбалка, круговорот воды, водная горка, бутылка воды, цунами, шторм, кальмар, неон, телеграм, дождевик, зонт, дожди, озон, ледокол, морская вода, большой барьерный риф, коралловый риф, аквапарк, ласты, супермен, капитан америка, эльза, аладдин, золушка, пейпал, майкрософт, виндовс, полиция, полицейский, павлин, ручка, холодный, мороз, стиральный, tug, sky, pen, sea, ice, cold, boat, ship, rain, pool, tide, fish, pond, lake, drip, wave, dory, raft, blue, tuna, neon, elsa, creek, shark, river, water, scuba, jeans, ferry, whale, kayak, squid, pepsi, ozone, sonic, genie, yacht, ocean, canoe, skype, puddle, shower, geyser, paypal, icicle, police, medusa, windows, dolphin, aquaman, samsung, mermaid, droplet, neptune, twitter, pacific, iceberg, wetsuit, glacier, aladdin, peacock, tsunami, atlantic, raincoat, sailboat, umbrella, blowfish, sapphire, sardines, stingray, seahorse, superman, facebook, dead sea, poseidon, aquarium, snowflake, north sea, water gun, microsoft, policeman, waterfall, blueberry, jellyfish, swordfish, saltwater, submarine, speedboat, shipwreck, coral reef, cinderella, anglerfish, cruise ship, storm drain, water cycle, pirate ship, water slide, ice fishing, water bottle, swimming pool, captain america, great barrier reef
purple: виноград, слива, баклажан, фиолетовый, сирень, лаванда, орхидея, пурпурный, ежевика, чернослив, твич, осьминог, танос, джокер, ведьма, волшебник, колдун, магия, зелье, дискорд, синяк, вуду, хрустальный шар, виноградный, фиалка, фортнайт, валуиджи, бабочка, инстаграм, фиолетовая, баклажанный, witch, joker, prune, lilac, magic, twitch, bruise, wizard, potion, thanos, voodoo, violet, grapes, orchid, purple, octopus, waluigi, discord, lavender, eggplant, fortnite, instagram, butterfly, blackberry, crystal ball
pink: розовый, свинья, поросенок, свинка пеппа, поросенок порки, жвачка, жевательная резинка, зефир, сладкая вата, фламинго, креветка, креветки, ветчина, сосиска, ластик, сакура, цветение, розовая пантера, хелло китти, конфета, капкейк, коралл, кораллы, патрик, единорог, фея, зубная фея, принцесса, балерина, бант, леденец, грейпфрут, свинина, колбаса, сардельки, прошутто, розовая, червяк, лилия, цветок, кирби, pig, ham, gum, pink, pork, worm, lily, fairy, coral, kirby, prawn, candy, flower, eraser, shrimp, cupcake, patrick, unicorn, blossom, sausage, princess, lollipop, flamingo, ballerina, porky pig, peppa pig, grapefruit, prosciutto, bubble gum, hello kitty, chewing gum, tooth fairy, marshmallow, cotton candy, pink panther, cherry blossom
brown: шоколад, кофе, какао, медведь, мишка, плюшевый мишка, обезьяна, лошадь, собака, щенок, олень, лось, бобр, белка, кабан, корова, осел, верблюд, бык, бизон, печенье, пряник, хлеб, багет, круассан, бублик, пирожок, булочка, блин, брауни, орех, грецкий орех, каштан, желудь, фундук, арахис, кешью, миндаль, пекан, пробка, бревно, древесина, доска, пень, палка, ветка, земля, грязь, почва, навоз, какашка, стейк, котлета, говядина, шашлык, мясо, мясной рулет, корица, имбирь, мускатный орех, картошка, батат, гриб, грибы, виски, гитара, скрипка, виолончель, контрабас, мебель, стол, стул, шкаф, комод, табуретка, дверь, пол, бочка, ящик, чемодан, сундук, кора, хомяк, суслик, бурундук, ежик, крот, енот, выдра, хорек, норка, соболь, горностай, косуля, сурок, лесной сурок, корги, чихуахуа, пудель, мопс, коала, лама, альпака, коза, козел, шимпанзе, павиан, вафля, вафли, маффин, кофеварка, кофейня, эспрессо, капучино, чай, чайный пакетик, бургер, гамбургер, хот-дог, шаурма, чебурек, беляш, ростбиф, жареная курица, курица, индейка, бутерброд, сэндвич, тост, гнездо, корень, изба, хижина, домик, амбар, конюшня, ферма, свинарник, конура, глина, горшок, кувшин, гончарное дело, ковбой, шериф, тотем, пират, медь, бронза, шоколадка, коричневый, утконос, лошадка, пони, мустанг, сухарик, бисквит, ковер, ковролин, древесный, дрова, поленья, паркет, лук, орел, сова, страус, улитка, скуби-ду, буратино, книга, борода, усы, бровь, бакенбарды, щетина, коричневая, печенька, крендель, bow, rug, pug, bun, hut, jug, cow, pot, log, tea, dog, nut, blt, owl, hen, mud, elk, bear, meat, root, cork, bull, boar, barn, goat, poop, wood, nest, soil, book, farm, clay, beef, dirt, deer, mole, pony, door, stick, brown, table, stump, cello, bread, board, horse, steak, chair, beard, floor, puppy, crate, acorn, toast, chest, snail, earth, cocoa, onion, otter, corgi, eagle, pecan, llama, koala, bagel, bison, cabin, totem, camel, closet, monkey, donkey, muffin, stable, ginger, poodle, bronze, coffee, pirate, waffle, violin, peanut, cashew, branch, fungus, marmot, cookie, carpet, ferret, copper, barrel, manure, potato, nutmeg, walnut, pigsty, cowboy, turkey, almond, gender, beaver, gopher, baboon, guitar, alpaca, pottery, pretzel, hot dog, ostrich, hamster, brownie, raccoon, tea bag, pancake, eyebrow, stubble, sheriff, whiskey, pitcher, biscuit, cinnamon, doghouse, platypus, espresso, mushroom, hedgehog, chipmunk, baguette, chestnut, sandwich, meatloaf, hazelnut, suitcase, mustache, squirrel, groundhog, hamburger, chocolate, chihuahua, sideburns, furniture, pinocchio, croissant, roast beef, teddy bear, scooby doo, contrabass, chimpanzee, cappuccino, traffic jam, gingerbread, coffee shop, coffee maker, sweet potato, fried chicken
black: ночь, уголь, черный, ворон, ворона, пантера, летучая мышь, бэтмен, гроб, нефть, шина, колесо, резина, чернила, тушь, паук, таракан, черная дыра, черная пятница, черный пояс, черный перец, лакрица, икра, смокинг, цилиндр, вампир, дракула, дарт вейдер, полночь, затмение, тень, темный, ночник, смерть, жнец, смерть с косой, чумной доктор, пианино, ботинки, сапоги, туфля, сажа, порох, бомба, ядерный взрыв, клоп, скарабей, тарантул, скорпион, терминатор, темница, бездна, апокалипсис, кошмар, злодей, убийца, киллер, бандит, грабитель, вор, взломщик, палач, чубакка, мусорное ведро, мусор, отбросы, черно-белый, зебра, панда, далматинец, шахматы, шашки, домино, винил, граммофон, саксофон, тьма, гангстер, маска, горилла, пингвин, муха, муравей, жук, очки, солнечные очки, микки маус, даффи дак, женщина-кошка, ресница, ночной клуб, кассета, динамик, колонка, черная, bat, bug, ink, ant, fly, tire, soot, coal, crow, thug, bomb, shoe, dark, nuke, mask, night, score, black, chess, wheel, vinyl, panda, zebra, trash, piano, thief, abyss, boots, death, prison, rubber, robber, spider, batman, beetle, shadow, caviar, coffin, reaper, tuxedo, garbage, eclipse, glasses, bed bug, vampire, eyelash, gorilla, villain, top hat, mascara, dracula, panther, speaker, penguin, burglar, gangster, licorice, assassin, cassette, midnight, dominoes, checkers, cylinder, murderer, scorpion, nightclub, chewbacca, cockroach, cat woman, trash can, saxophone, nightmare, gunpowder, dalmatian, tarantula, gramophone, black belt, sunglasses, apocalypse, terminator, nightlight, daffy duck, black hole, executioner, darth vader, grim reaper, black friday, mickey mouse, black pepper, plague doctor, zebra crossing, black and white
white: снег, снеговик, облако, молоко, сахар, соль, мука, рис, яйцо, зуб, овца, ягненок, кролик, белый, белый медведь, лебедь, чайка, призрак, привидение, мумия, скелет, кость, бумага, простыня, одеяло, подушка, ванна, унитаз, раковина, холодильник, стиральная машина, зубная паста, мыло, пена, пузырь, туман, дымка, пар, кефир, йогурт, творог, сметана, сливки, майонез, мел, гипс, бинт, халат, врач, медсестра, невеста, вуаль, ангел, нимб, зима, сугроб, метель, снегопад, снежок, кокос, чеснок, цветная капуста, мороженое, эскимо, белоснежка, альбатрос, аист, гусь, пегас, салфетка, бумажный платок, туалетная бумага, бумажные полотенца, полотенце, скатерть, вата, перышко, иней, кружево, жемчуг, бриллиант, белок, вареное яйцо, пельмень, тофу, лыжи, коньки, тарелка, зубная щетка, зубная нить, безе, ромашка, олаф, дональд дак, облачко, полярный, белая, снежный, fog, ski, egg, cast, rice, sink, mist, robe, bath, dish, bone, snow, soap, salt, lamb, veil, swan, halo, foam, milk, olaf, steam, stork, floss, cloud, sheep, pearl, goose, daisy, flour, nurse, mummy, towel, sheet, bride, tooth, sugar, angel, white, chalk, paper, ghost, pillow, winter, fridge, doctor, napkin, garlic, skates, yogurt, tissue, bubble, feather, pegasus, snowman, seagull, blanket, bandage, coconut, bathtub, protein, dumpling, blizzard, popsicle, snowball, skeleton, ice cream, snowstorm, albatross, polar bear, mayonnaise, boiled egg, tablecloth, snow white, toothbrush, toothpaste, cauliflower, donald duck, paper towels, toilet paper, washing machine
gray: слон, волк, мышь, мышка, крыса, серый, голубь, дым, пепел, камень, булыжник, валун, галька, скала, утес, гора, бетон, цемент, асфальт, дорога, тротуар, пыль, туча, гроза, меч, нож, топор, молоток, гвоздь, гайка, винтовка, пистолет, пушка, танк, робот, железо, металл, серебро, никель, ртуть, цепь, якорь, проволока, колючая проволока, сетка, рельс, железная дорога, труба, кран, консервная банка, ведро, лопата, пила, дрель, отвертка, гаечный ключ, инструмент, носорог, бегемот, койот, воробей, тоторо, надгробие, гробница, могила, бункер, замок, крепость, башня, стена, самолет, вертолет, ракета, космический корабль, спутник, линкор, авиалайнер, аэростат, дирижабль, цеппелин, броненосец, доспехи, рыцарь, шлем, каска, щит, ножницы, скрепка, степлер, скальпель, бритва, лезвие, кинжал, ятаган, рапира, штык, гарпун, копье, компьютер, ноутбук, клавиатура, процессор, видеокарта, материнская плата, телевизор, микроволновка, духовка, печь, кастрюля, сковородка, сковорода, ложка, вилка, столовые приборы, самовар, тиски, тачка, экскаватор, асфальтоукладчик, самосвал, вагон, электричка, метро, фура, грузовик, цистерна, камера, телефон, смартфон, сейф, болт, шуруп, гантель, железный гигант, сталь, мусоровоз, электростанция, завод, фабрика, небоскреб, здание, хобот, заяц, комар, микрофон, наушники, радио, дисплей, принтер, факс, калькулятор, лифт, наручники, багз банни, pan, rat, can, gun, saw, axe, ash, cpu, rail, lock, wall, nail, pipe, fork, dove, safe, clip, rock, tool, tank, road, tomb, vise, oven, grid, wolf, grey, plane, stone, metal, mouse, trunk, truck, chain, grave, drill, tower, spear, spoon, phone, spade, robot, radio, knife, smoke, metro, lorry, razor, blimp, cliff, rifle, sword, armor, hippo, rocket, pistol, bunker, rapier, cannon, knight, bucket, pebble, castle, hammer, totoro, silver, helmet, laptop, faucet, pigeon, dagger, cement, subway, nickel, shield, wrench, coyote, camera, anchor, keypad, bayonet, earbuds, printer, furnace, scalpel, display, stapler, boulder, trumpet, skillet, airship, harpoon, factory, missile, mercury, mountain, zeppelin, pavement, elevator, building, fortress, concrete, the rock, scissors, elephant, mosquito, airplane, hard hat, dumbbell, computer, keyboard, scimitar, railroad, tombstone, microwave, satellite, paperclip, spaceship, armadillo, excavator, handcuffs, television, smartphone, skyscraper, bugs bunny, iron giant, calculator, dump truck, battleship, microphone, silverware, helicopter, razorblade, rhinoceros, power plant, motherboard, screwdriver, barbed wire, fax machine, wheelbarrow, thunderstorm, graphics card, garbage truck
gold: золото, золотой слиток, золотые слитки, золотая цепь, золотое яйцо, золотое яблоко, золотая рыбка, корона, трон, медаль, кубок, монета, цент, сокровище, клад, горшок с золотом, алмаз, янтарь, шампанское, ключ, кольцо, ожерелье, браслет, скипетр, фараон, трофей, награда, приз, чемпион, победитель, победа, лев, король лев, сфинкс, пирамида, блестки, мишура, блинг, пшеница, золотой, золотая, золотое, тадж-махал, львенок, медальон, key, gold, cent, ring, coin, lion, crown, medal, prize, wheat, bling, amber, award, winner, trophy, throne, tinsel, sphinx, victory, glitter, pyramid, diamond, necklace, goldfish, treasure, bracelet, champion, taj mahal, lion king, champagne, gold ingot, gold chain, golden egg, gold ingots, pot of gold, golden apple, pharaoh
`;

// rgb - основной цвет (мягкий стиль и точка), bright - градиент яркого стиля, fg - цвет текста в ярком стиле
const COLOR_STYLES = {
    red:    { rgb: [239, 68, 68],   bright: ["#f87171", "#dc2626"], fg: "#ffffff" },
    orange: { rgb: [249, 115, 22],  bright: ["#fdba74", "#f97316"], fg: "#3b1500" },
    yellow: { rgb: [250, 204, 21],  bright: ["#fef08a", "#facc15"], fg: "#3f2b00" },
    green:  { rgb: [34, 197, 94],   bright: ["#86efac", "#22c55e"], fg: "#052e16" },
    blue:   { rgb: [59, 130, 246],  bright: ["#93c5fd", "#3b82f6"], fg: "#ffffff" },
    purple: { rgb: [168, 85, 247],  bright: ["#d8b4fe", "#9333ea"], fg: "#ffffff" },
    pink:   { rgb: [236, 72, 153],  bright: ["#fbcfe8", "#ec4899"], fg: "#4a0a26" },
    brown:  { rgb: [190, 110, 50],  bright: ["#c08457", "#7c4a21"], fg: "#ffffff" },
    black:  { rgb: [30, 41, 59],    bright: ["#4b5563", "#111827"], fg: "#ffffff", edge: "rgba(255,255,255,.55)", dot: "#0f172a" },
    white:  { rgb: [241, 245, 249], bright: ["#ffffff", "#e5e7eb"], fg: "#111827", edge: "rgba(255,255,255,.95)", alpha: .3, dot: "#f8fafc" },
    gray:   { rgb: [148, 163, 184], bright: ["#cbd5e1", "#64748b"], fg: "#0f172a" },
    gold:   { rgb: [234, 179, 8],   bright: ["#fde68a", "#d99a06"], fg: "#3b2300", edge: "rgba(253,224,71,.95)" },
};

const colorMap = new Map();
COLOR_DATA.split("\n").forEach(line => {
    const i = line.indexOf(":");
    if (i < 0) return;
    const color = line.slice(0, i).trim();
    line.slice(i + 1).split(",").forEach(w => {
        w = norm(w.toLowerCase().trim());
        if (w && !colorMap.has(w)) colorMap.set(w, color);
    });
});

// слова, которые начинаются с названия цвета: "красная панда", "золотая рыбка"...
const COLOR_RULES = [
    [/^красн/, "red"], [/^желт/, "yellow"], [/^зелен/, "green"], [/^(синий|синяя|синее|голуб)/, "blue"],
    [/^розов/, "pink"], [/^черн/, "black"], [/^(белый|белая|белое|белые)/, "white"], [/^коричнев/, "brown"],
    [/^(фиолет|пурпур)/, "purple"], [/^оранж/, "orange"], [/^сер(ый|ая|ое|ые)/, "gray"], [/^серебр/, "gray"],
    [/^золот/, "gold"], [/^(red|crimson) /, "red"], [/^yellow /, "yellow"], [/^green /, "green"], [/^blue /, "blue"],
    [/^pink /, "pink"], [/^black /, "black"], [/^white /, "white"], [/^(gold|golden) /, "gold"],
];

const colorCache = new Map();

function colorOf(word) {
    const w = norm(word.toLowerCase().trim());
    if (colorCache.has(w)) return colorCache.get(w);
    let c = colorMap.get(w) || null;
    if (!c) for (const [re, col] of COLOR_RULES) { if (re.test(w)) { c = col; break; } }
    colorCache.set(w, c);
    return c;
}


// ======================= ИНТЕРФЕЙС =======================
function createUI() {
    document.body.insertAdjacentHTML('beforeend', `
        <div id="ag-root">
            <div id="ag-toast"></div>

            <div id="ag-menu">
                <div class="ag-menu-title">⚙ Настройки</div>

                <div class="ag-row">
                    <div class="ag-row-text"><b>Автоугадывание</b><small>Отправляет подходящие слова по очереди каждые 3,5 с. Можно получить кик!</small></div>
                    <button id="sw-auto" class="ag-switch" aria-label="Автоугадывание"></button>
                </div>
                <div class="ag-row">
                    <div class="ag-row-text"><b>Отправлять единственный вариант</b><small>Когда остался ровно один подходящий вариант, он уходит сам - даже при выключенном автоугадывании.</small></div>
                    <button id="sw-last" class="ag-switch" aria-label="Отправлять единственный вариант"></button>
                </div>
                <div class="ag-row">
                    <div class="ag-row-text"><b>Пауза между словами</b><small>Защита от «Spam detected» при быстрых кликах</small></div>
                    <div class="ag-seg"><button id="gap-1">0,8 с</button><button id="gap-2">1,2 с</button><button id="gap-3">2 с</button></div>
                </div>
                <div class="ag-row">
                    <div class="ag-row-text"><b>Цвета слов</b><small>Банан жёлтый, огурец зелёный…</small></div>
                    <button id="sw-colors" class="ag-switch" aria-label="Цвета слов"></button>
                </div>
                <div class="ag-row"><b>Стиль цветов</b>
                    <div class="ag-seg"><button id="cs-soft">Мягкий</button><button id="cs-bright">Яркий</button><button id="cs-dot">Точка</button></div>
                </div>
                <div class="ag-row"><b>Размер слов</b>
                    <div class="ag-seg"><button id="sz-s">Мелкие</button><button id="sz-m">Средние</button><button id="sz-l">Крупные</button></div>
                </div>
                <div class="ag-row"><b>Список слов</b>
                    <div class="ag-seg"><button id="view-strip">Лента</button><button id="view-grid">Сетка</button></div>
                </div>
                <div class="ag-row"><b>Язык</b>
                    <div class="ag-seg"><button id="seg-auto">Авто</button><button id="seg-ru">Русский</button><button id="seg-en">English</button></div>
                </div>
                <div class="ag-row"><b>Искать по</b>
                    <div class="ag-seg"><button id="scope-cand">Подходящим</button><button id="scope-all">Всему словарю</button></div>
                </div>

                <div class="ag-sep">✨ ИИ по рисунку</div>
                <div class="ag-row">
                    <div class="ag-row-text"><b>Ключ</b><small id="ai-key-state" class="ag-val"></small></div>
                    <div class="ag-inline"><button id="ai-key" class="ag-mini">Задать</button><button id="ai-test" class="ag-mini">Проверить</button></div>
                </div>
                <div class="ag-row">
                    <div class="ag-row-text"><b>Модель</b><small id="ai-model-label" class="ag-val"></small></div>
                    <div class="ag-inline"><button id="ai-model-prev" class="ag-mini" title="Предыдущая модель">‹</button><button id="ai-model-next" class="ag-mini" title="Следующая модель">›</button></div>
                </div>
                <div class="ag-row">
                    <div class="ag-row-text"><b>ИИ-авто</b><small id="ai-auto-hint"></small></div>
                    <button id="sw-aiauto" class="ag-switch" aria-label="ИИ-авто"></button>
                </div>

                <div class="ag-sep">📚 Словарь</div>
                <div class="ag-row">
                    <div class="ag-row-text"><b>Слова в памяти</b><small id="dict-status" class="ag-val">загружаю…</small></div>
                    <div class="ag-inline"><button id="dict-refresh" class="ag-mini">Обновить</button><button id="dict-reset" class="ag-mini">Сбросить</button><button id="export-answers" class="ag-mini">Экспорт</button></div>
                </div>
                <div class="ag-row ag-row-last"><button id="get-special" class="ag-mini">Секрет</button><small>v3.2 · Клавиши: ↑ ↓ - панель · / - поиск</small></div>
            </div>

            <div class="ag-panel">
                <div class="ag-bar">
                    <span id="remaining-guesses" class="ag-pill">Вариантов: 0</span>
                    <button id="lang-mode" class="ag-pill ag-pill-btn" title="Язык слов: нажми, чтобы переключить">🌐 Авто</button>
                    <div class="ag-search">
                        <span class="ag-search-ico">🔍</span>
                        <input id="ag-search" type="text" placeholder="Поиск слова: кив · _ив_ · к*и  ( / )" autocomplete="off" spellcheck="false">
                        <button id="ag-search-clear" title="Очистить">✕</button>
                    </div>
                    <button id="ai-guess" class="ag-btn ag-btn-ai" title="Отправить рисунок ИИ и получить варианты слов">✨ ИИ: угадать</button>
                    <button id="ag-menu-btn" class="ag-btn" title="Настройки">⚙ Меню</button>
                    <button id="ui-hide" class="ag-btn ag-btn-ghost" title="Скрыть панель (стрелка вниз)">▼</button>
                </div>
                <div id="ai-shelf" class="ag-shelf"></div>
                <div id="search-shelf" class="ag-shelf"></div>
                <div id="guess-shelf" class="ag-shelf"></div>
            </div>

            <style>
                #ag-root, #ag-root * { box-sizing: border-box; }
                #ag-root {
                    position: fixed; left: 0; right: 0; bottom: 0; z-index: 9998;
                    font: 14px/1.25 "Segoe UI", system-ui, -apple-system, Roboto, sans-serif; color: #fff;
                    transition: transform .18s ease;
                }
                #ag-root.ag-hidden { transform: translateY(115%); }
                #ag-root button { font-family: inherit; }
                .ag-panel {
                    position: relative;
                    background: linear-gradient(180deg, rgba(34, 54, 128, .94), rgba(13, 24, 74, .97));
                    backdrop-filter: blur(14px) saturate(150%);
                    border-top: 1px solid rgba(255, 255, 255, .28);
                    border-radius: 20px 20px 0 0;
                    box-shadow: 0 -12px 40px rgba(0, 0, 0, .35), inset 0 1px 0 rgba(255, 255, 255, .15);
                    padding: 10px 16px 12px;
                }
                .ag-bar { display: flex; align-items: center; gap: 10px; }
                .ag-pill {
                    flex: 0 0 auto; background: rgba(255, 255, 255, .12); border: 1px solid rgba(255, 255, 255, .22);
                    border-radius: 999px; padding: 8px 14px; font-weight: 600; white-space: nowrap; color: #fff;
                }
                .ag-pill-btn { cursor: pointer; transition: background .15s; }
                .ag-pill-btn:hover { background: rgba(255, 255, 255, .22); }
                .ag-search {
                    flex: 1 1 220px; min-width: 130px; height: 38px; display: flex; align-items: center; gap: 6px;
                    background: rgba(0, 0, 0, .28); border: 1px solid rgba(255, 255, 255, .24); border-radius: 12px; padding: 0 6px 0 10px;
                }
                .ag-search:focus-within { border-color: #7dd3fc; box-shadow: 0 0 0 3px rgba(125, 211, 252, .25); }
                .ag-search input {
                    flex: 1; min-width: 0; height: 100%; background: transparent; border: 0; outline: 0; color: #fff; font-size: 15px;
                }
                .ag-search input::placeholder { color: rgba(255, 255, 255, .5); }
                .ag-search button { background: transparent; border: 0; color: rgba(255, 255, 255, .6); cursor: pointer; font-size: 14px; padding: 4px 6px; border-radius: 8px; }
                .ag-search button:hover { color: #fff; background: rgba(255, 255, 255, .15); }
                .ag-btn {
                    flex: 0 0 auto; height: 38px; padding: 0 16px; border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap;
                    background: linear-gradient(135deg, rgba(255, 255, 255, .22), rgba(255, 255, 255, .1)); border: 1px solid rgba(255, 255, 255, .28);
                    transition: transform .12s, filter .12s;
                }
                .ag-btn:hover { filter: brightness(1.15); }
                .ag-btn:active { transform: scale(.96); }
                .ag-btn-ai { background: linear-gradient(135deg, #22c55e, #0d9488); border-color: rgba(255, 255, 255, .45); box-shadow: 0 0 14px rgba(34, 197, 94, .45); }
                .ag-btn-ghost { padding: 0 12px; }
                .ag-shelf {
                    display: flex; gap: 8px; align-items: center; overflow-x: auto; padding: 10px 2px 2px;
                    scrollbar-width: thin; user-select: none; cursor: grab;
                }
                .ag-shelf:empty { display: none; }
                .ag-shelf.dragging { cursor: grabbing; }
                .ag-shelf.wrap { flex-wrap: wrap; max-height: 34vh; overflow-x: hidden; overflow-y: auto; cursor: default; }
                .ag-label { flex: 0 1 auto; max-width: 340px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; font-size: 13px; color: #bae6fd; padding-right: 4px; }
                .ag-chip {
                    flex: 0 0 auto; padding: 8px 14px; border-radius: 12px; font-size: 15px; font-weight: 700; color: #fff; cursor: pointer;
                    background: linear-gradient(135deg, rgba(255, 255, 255, .24), rgba(255, 255, 255, .08));
                    border: 1px solid rgba(255, 255, 255, .3); text-shadow: none;
                    transition: transform .12s, filter .12s;
                }
                .ag-chip:hover { transform: translateY(-2px); filter: brightness(1.08); }
                .ag-chip:active { transform: scale(.95); }
                .ag-chip.ag-chip-add { border-style: dashed; color: #bae6fd; }
                .ag-chip.ag-chip-ai { outline: 2px solid rgba(74, 222, 128, .9); outline-offset: 1px; }
                .ag-size-s .ag-chip { padding: 5px 10px; font-size: 13px; border-radius: 10px; }
                .ag-size-l .ag-chip { padding: 11px 18px; font-size: 18px; border-radius: 14px; }
                .ag-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 7px; vertical-align: middle; border: 1px solid rgba(255,255,255,.6); }
                #ag-root input { margin: 0; padding: 0; box-shadow: none; text-transform: none; letter-spacing: normal; line-height: normal; }
                #ag-root button { margin: 0; text-transform: none; letter-spacing: normal; }

                #ag-menu {
                    display: none; position: absolute; right: 14px; bottom: calc(100% + 10px); width: 470px; max-width: calc(100vw - 28px);
                    max-height: 72vh; overflow-y: auto; padding: 10px 16px 12px;
                    background: rgba(13, 22, 66, .98); border: 1px solid rgba(255, 255, 255, .25); border-radius: 18px; box-shadow: 0 14px 44px rgba(0, 0, 0, .5);
                }
                #ag-root.ag-menu-open #ag-menu { display: block; }
                .ag-menu-title { font-size: 16px; font-weight: 800; padding: 4px 0 8px; }
                .ag-sep { margin-top: 12px; padding: 6px 0 2px; font-weight: 800; color: #7dd3fc; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; border-top: 1px solid rgba(255, 255, 255, .15); }
                .ag-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid rgba(255, 255, 255, .08); }
                .ag-row-last { border-bottom: 0; }
                .ag-row b { font-weight: 700; }
                .ag-row small { display: block; margin-top: 2px; color: rgba(255, 255, 255, .6); font-size: 12px; font-weight: 400; }
                .ag-row-text { min-width: 0; }
                .ag-inline { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
                .ag-val { color: #bae6fd !important; font-size: 12.5px !important; }
                .ag-state { color: rgba(255, 255, 255, .85); font-size: 13px; text-align: right; }
                .ag-mini {
                    border: 1px solid rgba(255, 255, 255, .28); background: rgba(255, 255, 255, .14); color: #fff; border-radius: 9px;
                    padding: 6px 10px; font-size: 13px; font-weight: 600; cursor: pointer;
                }
                .ag-mini:hover { background: rgba(255, 255, 255, .26); }
                .ag-switch { position: relative; flex: 0 0 auto; width: 46px; height: 26px; border: 0; border-radius: 999px; background: rgba(255, 255, 255, .25); cursor: pointer; transition: background .15s; }
                .ag-switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform .15s; }
                .ag-switch.on { background: #22c55e; }
                .ag-switch.on::after { transform: translateX(20px); }
                .ag-seg { display: flex; padding: 2px; border-radius: 10px; background: rgba(0, 0, 0, .35); }
                .ag-seg button { border: 0; background: transparent; color: #fff; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700; white-space: nowrap; }
                .ag-seg button.on { background: #7dd3fc; color: #0b1b4a; }

                #ag-toast {
                    display: none; position: absolute; left: 50%; bottom: calc(100% + 12px); transform: translateX(-50%);
                    max-width: min(760px, 92vw); padding: 10px 18px; border-radius: 14px; font-weight: 600; text-align: center;
                    background: rgba(13, 22, 66, .97); border: 1px solid rgba(255, 255, 255, .3); box-shadow: 0 10px 30px rgba(0, 0, 0, .45);
                }
                #ag-toast.show { display: block; }
                #ag-handle {
                    display: none; position: fixed; right: 16px; bottom: 10px; z-index: 9999; height: 38px; padding: 0 16px; border-radius: 12px;
                    font: 700 14px "Segoe UI", system-ui, sans-serif; color: #fff; cursor: pointer;
                    background: linear-gradient(135deg, rgba(34, 54, 128, .96), rgba(13, 24, 74, .98)); border: 1px solid rgba(255, 255, 255, .35);
                }
                #ag-root.ag-hidden + #ag-handle { display: block; }
            </style>
        </div>
        <button id="ag-handle">▲ Панель</button>
    `);
}

createUI();

const $ = id => document.getElementById(id);
const root = $("ag-root");

function setHidden(hidden) {
    root.classList.toggle("ag-hidden", hidden);
    if (hidden) root.classList.remove("ag-menu-open");
}

$("ui-hide").addEventListener("click", () => setHidden(true));
$("ag-handle").addEventListener("click", () => setHidden(false));
$("ag-menu-btn").addEventListener("click", () => root.classList.toggle("ag-menu-open"));

// клик вне меню закрывает его
document.addEventListener("click", e => {
    if (!root.classList.contains("ag-menu-open")) return;
    if (e.target && e.target.closest && e.target.closest("#ag-menu, #ag-menu-btn")) return;
    root.classList.remove("ag-menu-open");
});

document.addEventListener("keydown", e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "ArrowDown") { setHidden(true); e.preventDefault(); }
    if (e.key === "ArrowUp") { setHidden(false); e.preventDefault(); }
    if (e.key === "/") { setHidden(false); $("ag-search").focus(); e.preventDefault(); }
});

let toastTimer;
function toast(text, ms = 4500) {
    const t = $("ag-toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// Листание полок мышью: колесо и перетаскивание (клик по слову при этом работает как обычно)
function enableSlide(el) {
    el.addEventListener("wheel", e => {
        if (el.classList.contains("wrap") || el.scrollWidth <= el.clientWidth) return;
        el.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        e.preventDefault();
    }, { passive: false });

    let down = false, moved = false, startX = 0, startLeft = 0;
    el.addEventListener("mousedown", e => {
        moved = false;
        if (el.classList.contains("wrap")) return;
        down = true; startX = e.pageX; startLeft = el.scrollLeft;
    });
    window.addEventListener("mousemove", e => {
        if (!down) return;
        const dx = e.pageX - startX;
        if (Math.abs(dx) > 5) { moved = true; el.classList.add("dragging"); }
        if (moved) el.scrollLeft = startLeft - dx;
    });
    window.addEventListener("mouseup", () => { down = false; el.classList.remove("dragging"); });
    // после перетаскивания гасим случайный клик по кнопке
    el.addEventListener("click", e => {
        if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    }, true);
}

["ai-shelf", "search-shelf", "guess-shelf"].forEach(id => enableSlide($(id)));

// красит кнопку-слово по её цвету в выбранном стиле
function paintChip(b, c) {
    const s = COLOR_STYLES[c], [r, g, bl] = s.rgb;
    if (colorStyle === "bright") {
        b.style.background = `linear-gradient(135deg, ${s.bright[0]}, ${s.bright[1]})`;
        b.style.color = s.fg;
        b.style.borderColor = "rgba(255,255,255,.75)";
    } else if (colorStyle === "dot") {
        const dot = document.createElement("span");
        dot.className = "ag-dot";
        dot.style.background = s.dot || `rgb(${r},${g},${bl})`;
        dot.style.boxShadow = `0 0 7px rgba(${r},${g},${bl},.9)`;
        b.insertBefore(dot, b.firstChild);
    } else {   // мягкий: цветное стекло с цветной рамкой
        const a = s.alpha || 0.64;
        b.style.background = `linear-gradient(135deg, rgba(${r},${g},${bl},${a}), rgba(${r},${g},${bl},${(a * 0.42).toFixed(2)}))`;
        b.style.borderColor = s.edge || `rgba(${r},${g},${bl},.95)`;
        b.style.boxShadow = `0 0 12px rgba(${r},${g},${bl},.28)`;
    }
}

// кнопка-слово: раскрашивается по цвету слова
function makeChip(word, extraClass) {
    const b = document.createElement("button");
    b.className = "ag-chip" + (extraClass ? " " + extraClass : "");
    b.textContent = word;
    b.onclick = () => { if (!submitGuess(word)) toast("Подожди секунду: защита от спама (паузу можно изменить в меню)", 1600); };
    const c = colorsOn ? colorOf(word) : null;
    if (c) paintChip(b, c);
    return b;
}

function labelEl(text) {
    const s = document.createElement("span");
    s.className = "ag-label";
    s.textContent = text;
    return s;
}


// ======================= СЕТЬ =======================
function httpRequest(opts) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest(Object.assign({}, opts, {
            timeout: 30000,
            onload: r => resolve(r),
            onerror: () => reject(new Error("нет сети")),
            ontimeout: () => reject(new Error("таймаут"))
        }));
    });
}

async function postJSON(url, headers, body) {
    const r = await httpRequest({ method: "POST", url, headers, data: JSON.stringify(body) });
    if (r.status >= 200 && r.status < 300) {
        try { return JSON.parse(r.responseText); } catch (e) { throw new Error("плохой ответ"); }
    }
    let msg = "";
    try { msg = JSON.parse(r.responseText).error.message || ""; } catch (e) { /* не JSON */ }
    throw new Error(`HTTP ${r.status}${msg ? ": " + msg : ""}`);
}

// Скачивает список слов. Сначала через GM_xmlhttpRequest (не зависит от CSP сайта), потом через fetch.
async function fetchWords(url) {
    let text = "";
    try {
        const r = await httpRequest({ method: "GET", url });
        if (r.status === 200) text = r.responseText;
    } catch (e) { /* пробуем fetch */ }
    if (!text) {
        try {
            const resp = await fetch(url);
            if (resp.ok) text = await resp.text();
        } catch (e) { /* нет доступа */ }
    }
    return text.split(/\r?\n/).map(w => norm(w.toLowerCase().trim())).filter(w => w !== '');
}


// ======================= СЛОВАРИ И ОЧКИ =======================
const correctAnswers = GM_getValue("correctAnswers", []);
const boosts = GM_getValue("boosts", {});

// чистим пустые строки, если они когда-то попали в хранилище
for (let i = correctAnswers.length - 1; i >= 0; i--) {
    if (!correctAnswers[i]) correctAnswers.splice(i, 1);
}

// priorFrac[слово] = позиция в своём списке (0..1): меньше - приоритетнее
let priorFrac = GM_getValue("priorFrac", {});

function applyPrior(words) {
    words.forEach((word, i) => { priorFrac[word] = i / words.length; });
}

function scoreOf(word) {
    const frac = priorFrac[word];
    const prior = frac === undefined ? 0 : 5 * (1 - frac);
    return (boosts[word] || 0) + prior;
}

function sortByScore() {
    correctAnswers.sort((a, b) => scoreOf(b) - scoreOf(a));
}

function mergeWords(words) {
    const known = new Set(correctAnswers);
    words.forEach(word => {
        if (!known.has(word)) { correctAnswers.push(word); known.add(word); }
    });
}

let dictFailed = [];
let dictLoading = false;

function updateDictStatus() {
    let ru = 0, en = 0;
    for (const w of correctAnswers) { if (isCyr(w)) ru++; else en++; }
    $("dict-status").textContent = dictLoading
        ? "загружаю словари…"
        : `RU ${ru} · EN ${en}` + (dictFailed.length ? " ⚠ не скачалось" : "");
    $("dict-status").title = dictFailed.length ? "Не загрузились:\n" + dictFailed.join("\n") : "";
}

async function fetchAndStoreLatestWordlists() {
    if (dictLoading) return;            // уже идёт загрузка
    dictLoading = true; dictFailed = []; updateDictStatus();
    const urls = RU_WORDLIST_URLS.concat(ENABLE_ENGLISH ? [EN_WORDLIST_URL] : []);
    for (const url of urls) {
        const words = await fetchWords(url);
        if (!words.length) { dictFailed.push(url); continue; }
        applyPrior(words);
        mergeWords(words);
    }
    sortByScore();
    GM_setValue("correctAnswers", correctAnswers);
    GM_setValue("priorFrac", priorFrac);
    dictLoading = false;
    updateDictStatus();
    if (dictFailed.length) toast("Словарь не скачался с GitHub. Проверь ссылку в скрипте и что репозиторий публичный.", 7000);
}

// полный сброс: забываем всё выученное (в т.ч. мусор из старых списков) и качаем заново
async function resetDictionary() {
    if (!window.confirm("Стереть все выученные слова и заново загрузить словари с GitHub?\n(Если хочешь сохранить выученное - сначала нажми «Экспорт».)")) return;
    correctAnswers.length = 0;
    Object.keys(boosts).forEach(k => delete boosts[k]);
    priorFrac = {};
    GM_setValue("boosts", boosts);
    possibleWords = [];
    generateGuesses();
    while (dictLoading) await new Promise(r => setTimeout(r, 100));   // дожидаемся текущей загрузки
    await fetchAndStoreLatestWordlists();
    toast("Словарь сброшен и загружен заново ✓");
}

sortByScore();
updateDictStatus();
fetchAndStoreLatestWordlists();


// ======================= ЯЗЫК КОМНАТЫ =======================
// auto - определять сам, ru / en - задать вручную
let langMode = GM_getValue("langMode", "auto");
let detectedLang = null;

function activeLang() {
    return langMode === "auto" ? detectedLang : langMode;
}

function langOk(word) {
    const lang = activeLang();
    if (!lang) return true;
    return lang === "ru" ? isCyr(word) : !isCyr(word);
}

// по открытым буквам; true - если язык определился заново / сменился
function detectLang(text) {
    const next = isCyr(text) ? "ru" : /[a-z]/i.test(text) ? "en" : null;
    if (!next || next === detectedLang) return false;
    detectedLang = next;
    refreshControls();
    return true;
}

// язык из выпадающего списка на главной странице (первая догадка до открытия букв)
function langFromSelect(sel) {
    if (!sel || sel.tagName !== "SELECT" || sel.selectedIndex < 0 || !sel.options[sel.selectedIndex]) return null;
    const t = (sel.options[sel.selectedIndex].text + " " + sel.value).toLowerCase();
    if (/russian|русск/.test(t)) return "ru";
    if (/english|англ/.test(t)) return "en";
    return null;
}

function applyLobbyLang() {
    const l = langFromSelect(document.querySelector("#home select") || document.querySelector("select"));
    if (l && l !== detectedLang) { detectedLang = l; refreshControls(); }
}

document.addEventListener("change", e => {
    const l = langFromSelect(e.target);
    if (l && l !== detectedLang) { detectedLang = l; refreshControls(); }
});

function setLangMode(mode) {
    langMode = mode;
    GM_setValue("langMode", langMode);
    refreshControls();
    // пересчитываем список только во время раунда (иначе в нём окажется весь словарь)
    if (document.querySelector(".hints .hint")) {
        possibleWords = filterHints(correctAnswers);
        generateGuesses();
    } else {
        runSearch();
    }
}

$("lang-mode").addEventListener("click", () => setLangMode({ auto: "ru", ru: "en", en: "auto" }[langMode]));
$("seg-auto").addEventListener("click", () => setLangMode("auto"));
$("seg-ru").addEventListener("click", () => setLangMode("ru"));
$("seg-en").addEventListener("click", () => setLangMode("en"));


// ======================= НАСТРОЙКИ ВИДА =======================
let gridMode = GM_getValue("gridMode", false);
let colorsOn = GM_getValue("colorsOn", true);
let searchScope = GM_getValue("searchScope", "cand");   // cand - по подходящим, all - по всему словарю
let aiWordsShown = [];
let aiNote = "";
// Когда остался один подходящий вариант, отправить его самому (работает и при выключенном автоугадывании)
let autoLast = GM_getValue("autoLast", true);
let colorStyle = GM_getValue("colorStyle", "soft");   // soft - мягкий, bright - яркий, dot - точка
let chipSize = GM_getValue("chipSize", "m");          // s, m, l
let guessGap = GM_getValue("guessGap", MIN_GUESS_INTERVAL);

const repaintChips = () => { generateGuesses(); renderAI(aiWordsShown, aiNote); runSearch(); };
[["cs-soft", "soft"], ["cs-bright", "bright"], ["cs-dot", "dot"]].forEach(([id, v]) =>
    $(id).addEventListener("click", () => { colorStyle = v; GM_setValue("colorStyle", v); refreshControls(); repaintChips(); }));
[["sz-s", "s"], ["sz-m", "m"], ["sz-l", "l"]].forEach(([id, v]) =>
    $(id).addEventListener("click", () => { chipSize = v; GM_setValue("chipSize", v); refreshControls(); }));
[["gap-1", 800], ["gap-2", 1200], ["gap-3", 2000]].forEach(([id, v]) =>
    $(id).addEventListener("click", () => { guessGap = v; GM_setValue("guessGap", v); refreshControls(); }));
$("sw-last").addEventListener("click", () => { autoLast = !autoLast; GM_setValue("autoLast", autoLast); refreshControls(); });
$("view-strip").addEventListener("click", () => { gridMode = false; GM_setValue("gridMode", gridMode); refreshControls(); });
$("view-grid").addEventListener("click", () => { gridMode = true; GM_setValue("gridMode", gridMode); refreshControls(); });
$("sw-colors").addEventListener("click", () => {
    colorsOn = !colorsOn;
    GM_setValue("colorsOn", colorsOn);
    refreshControls();
    repaintChips();
});
$("scope-cand").addEventListener("click", () => { searchScope = "cand"; GM_setValue("searchScope", searchScope); refreshControls(); runSearch(); });
$("scope-all").addEventListener("click", () => { searchScope = "all"; GM_setValue("searchScope", searchScope); refreshControls(); runSearch(); });


// ======================= ИГРОК =======================
let myUsername = '';

function readMyName() {
    const me = document.querySelector(".me");
    if (!me) return '';
    // убираем приписку в скобках: (You), (Вы) и т.п.
    return me.textContent.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function findUsername() {
    const target = document.querySelector(".players-list");
    if (!target) return;

    const observer = new MutationObserver(() => {
        const name = readMyName();
        if (name) {
            myUsername = name;
            observer.disconnect();
        }
    });

    observer.observe(target, { childList: true });
}

findUsername();


function observeDrawingTurn() {
    const target = document.querySelector(".words");
    if (!target) return;

    const observer = new MutationObserver(() => {
        target.childNodes.forEach(word => {
            const text = word.textContent.toLowerCase().trim();
            if (!text) return;

            detectLang(text);
            if (!word._agBound) {                // не вешаем обработчик повторно
                word._agBound = true;
                word.addEventListener("click", () => storeAnswer(text));
            }

            if (!correctAnswers.includes(text)) {
                correctAnswers.push(text);
                GM_setValue("correctAnswers", correctAnswers);
            }
        });
    });

    observer.observe(target, { childList: true });
}

observeDrawingTurn();


// ======================= ПОДСКАЗКИ =======================
const remainingButton = $("remaining-guesses");

const guessShelf = $("guess-shelf");

let possibleWords = [];

const input = document.querySelector('#game-chat input[data-translate="placeholder"]')
           || document.querySelector('#game-chat input[type="text"]')
           || document.querySelector('#game-chat input');

if (!input) {
    console.error("[AutoGuesser] не найдено поле ввода чата - скрипт остановлен");
    return;
}

let lastSubmitAt = 0;

function canSubmit() {
    return Date.now() - lastSubmitAt >= guessGap;
}

// force - для слова, которое игрок сам ввёл и подтвердил Enter
function submitGuess(word, force) {
    if (!word || !word.trim()) return false;
    if (!force && !canSubmit()) return false;
    lastSubmitAt = Date.now();
    input.value = word;
    input.closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return true;
}

function renderGuesses(words) {
    guessShelf.innerHTML = '';
    remainingButton.textContent = `Вариантов: ${possibleWords.length}`;
    words.slice(0, MAX_RENDER).forEach(word => guessShelf.appendChild(makeChip(word)));
}

function generateGuesses() {
    if (possibleWords.length === 1 && autoLast && canSubmit() && !input.value.trim()) {
        submitGuess(possibleWords.shift());
    }
    const pattern = norm(input.value.toLowerCase().trim());
    const words = possibleWords.filter(word => norm(word).startsWith(pattern));
    renderGuesses(words);
    runSearch();
}

function observeInput() {
    input.addEventListener("input", generateGuesses);

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            // сами отправляем слово, чтобы форма не отправилась второй раз
            e.preventDefault();
            const word = guessShelf.firstElementChild?.innerText ?? input.value;
            submitGuess(word, true);
        }
    });
}

observeInput();


function storeAnswer(word) {
    word = word.toLowerCase().trim();
    if (!word) return [];

    for (const w in boosts) {
        boosts[w] *= 0.98; // DECAY
        if (boosts[w] < 0.01) delete boosts[w];
    }
    boosts[word] = (boosts[word] || 0) + 1;

    if (!correctAnswers.includes(word)) {
        correctAnswers.push(word);
        GM_setValue("correctAnswers", correctAnswers);
    }

    sortByScore();
    GM_setValue("boosts", boosts);
    return [];
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Текущая подсказка: шаблон вида "___б_" и регулярка для него
function readHints() {
    const hints = Array.from(document.querySelectorAll(".hints .hint"));
    const texts = hints.map(hint => hint.textContent.replace(/\u00a0/g, ' '));
    const combined = texts.map(t => t === '_' ? LETTER_CLASS : escapeRegex(norm(t))).join('');
    return {
        hints,
        pattern: texts.join(''),
        regex: new RegExp(`^${combined}$`, 'i'),
        allUncovered: hints.length > 0 && hints.every(hint => hint.classList.contains("uncover"))
    };
}

function filterHints(inputWords) {
    const info = readHints();
    if (!info.hints.length) return inputWords;

    if (info.allUncovered) {
        detectLang(info.pattern);
        return storeAnswer(info.pattern);
    }

    // открытые буквы подсказывают язык; если язык сменился - начинаем с полного списка
    const revealed = info.pattern.replace(/[_\s\-]/g, '');
    if (revealed && detectLang(revealed)) inputWords = correctAnswers;

    return inputWords.filter(word => info.regex.test(norm(word)) && langOk(word));
}

function observeHints() {
    const target = document.querySelector(".hints .container");
    if (!target) return;

    const observer = new MutationObserver(() => {
        possibleWords = filterHints(possibleWords);
        refreshAiForHint();
        generateGuesses();
    });

    observer.observe(target, { childList: true, subtree: true });
}

// слова от ИИ должны всегда подходить под ТЕКУЩУЮ подсказку (она меняется по ходу раунда)
function refreshAiForHint() {
    if (!aiWordsShown.length) return;
    const info = readHints();
    if (!info.hints.length || info.allUncovered) { renderAI([]); return; }   // раунд закончился
    const keep = aiWordsShown.filter(w => info.regex.test(norm(w)));
    if (keep.length !== aiWordsShown.length) renderAI(keep, aiNote);
}

observeHints();


// ======================= ПОИСК СЛОВ =======================
// Запрос: "кив" - слова, где есть эти буквы; "_ив_" - "_" или "?" одна любая буква; "к*и" - "*" любые буквы
const searchInput = $("ag-search");
const searchShelf = $("search-shelf");

function searchTest(q) {
    if (/[_?*]/.test(q)) {
        const re = new RegExp("^" + q.split("").map(ch =>
            ch === "_" || ch === "?" ? LETTER_CLASS : ch === "*" ? ".*" : escapeRegex(ch)).join("") + "$", "i");
        return w => re.test(norm(w));
    }
    return w => norm(w).includes(q);
}

function runSearch() {
    const q = norm(searchInput.value.toLowerCase().trim());
    searchShelf.innerHTML = '';
    if (!q) return;

    const pool = (searchScope === "cand" && possibleWords.length) ? possibleWords : correctAnswers;
    const test = searchTest(q);
    const found = pool.filter(w => langOk(w) && test(w));
    // сначала те, что начинаются с запроса, потом короткие
    found.sort((a, b) => (norm(b).startsWith(q) - norm(a).startsWith(q)) || (a.length - b.length));

    searchShelf.appendChild(labelEl(found.length ? `🔍 Найдено: ${found.length}` : "🔍 Ничего не найдено"));
    found.slice(0, MAX_SEARCH).forEach(word => searchShelf.appendChild(makeChip(word)));

    // слова нет в словаре - можно добавить (запомнится и будет подсказываться дальше)
    const raw = searchInput.value.toLowerCase().trim();
    if (!found.length && raw.length >= 3 && !/[_?*]/.test(raw) && /^[a-zа-яё\- ]+$/i.test(raw)) {
        const add = document.createElement("button");
        add.className = "ag-chip ag-chip-add";
        add.textContent = `➕ Добавить «${raw}» в словарь`;
        add.onclick = () => addLearnedWord(raw);
        searchShelf.appendChild(add);
    }
}

function addLearnedWord(word) {
    word = norm(word.toLowerCase().trim());
    if (!word) return;
    if (!correctAnswers.includes(word)) {
        correctAnswers.push(word);
        boosts[word] = (boosts[word] || 0) + 2;     // выученное слово получает приоритет
        sortByScore();
        GM_setValue("correctAnswers", correctAnswers);
        GM_setValue("boosts", boosts);
    }
    // если слово подходит под текущую подсказку - сразу показываем в списке
    const info = readHints();
    if (info.hints.length && !info.allUncovered && info.regex.test(word) && !triedWords.has(word) && !possibleWords.includes(word)) {
        possibleWords.unshift(word);
    }
    toast(`Слово «${word}» добавлено в словарь ✓`);
    updateDictStatus();
    generateGuesses();
}

searchInput.addEventListener("input", runSearch);
searchInput.addEventListener("keydown", e => {
    if (e.key === "Enter") {
        e.preventDefault();
        const first = searchShelf.children[1];
        if (first) submitGuess(first.textContent, true);
    }
    if (e.key === "Escape") { searchInput.value = ""; runSearch(); searchInput.blur(); }
});
// чтобы буквы из поиска не превращались в горячие клавиши игры (B, F, U, C...)
["keydown", "keyup", "keypress"].forEach(t => searchInput.addEventListener(t, e => e.stopPropagation()));
$("ag-search-clear").addEventListener("click", () => { searchInput.value = ""; runSearch(); searchInput.focus(); });


//  Banded Levenshtein: O(n*min(m,2k+1)) time, O(m) space
//  Возвращает расстояние, либо -1 если оно > k
function levenshteinDistance(a, b, k = 1) {
    if (a.length > b.length) {
        let tmp = a;
        a = b;
        b = tmp;
    }
    let m = a.length;
    let n = b.length;

    if (n - m > k) return -1;

    // Обрезаем общий префикс/суффикс
    let start = 0;
    while (start < m && a[start] === b[start]) ++start;
    let endA = m - 1, endB = n - 1;
    while (endA >= start && a[endA] == b[endB]) --endA, --endB;
    m = endA - start + 1;
    n = endB - start + 1;

    if (m === 0) return n;

    const buf = new Uint8Array((m + 1) * 2);
    const D0 = buf.subarray(0, m + 1);
    for (let j = 0; j <= m; j++) D0[j] = j;
    const D1 = buf.subarray(m + 1, (m + 1) * 2);

    let curr, prev;
    for (let i = 1; i <= n; i++) {
        if (i & 1) { curr = D1; prev = D0; }
        else       { curr = D0; prev = D1; }

        let lo = i - k; if (lo < 1) lo = 1;
        let hi = i + k; if (hi > m) hi = m;

        curr[lo - 1] = i;

        let rowMin = k + 1;
        const bi = b[start + i - 1];
        for (let j = lo; j <= hi; j++) {
            const aj = a[start + j - 1];
            const cost = (aj == bi) ? 0 : 1;
            const val = Math.min(
                curr[j - 1] + 1,
                prev[j]     + 1,
                prev[j - 1] + cost
            );
            curr[j] = val;
            if (val < rowMin) rowMin = val;
        }

        if (rowMin > k) return -1;
    }

    const distance = ((n & 1) ? D1 : D0)[m];
    if (distance > k) return -1;
    return distance;
}

let previousWords = [];
let lastMyGuess = '';
let turnId = 0;
let triedWords = new Set();   // слова, которые в этом ходу уже называли (они неверные)

function handleChatMessage(messageNode) {
    if (!messageNode) return;
    const messageColor = window.getComputedStyle(messageNode).color;
    const message = messageNode.textContent;

    // Синее сообщение "... is drawing now!" - новый ход (не зависит от языка интерфейса)
    if (messageColor === "rgb(57, 117, 206)" && !message.includes(": ")) {
        turnId++;
        triedWords = new Set();
        renderAI([]);
        previousWords = [];
        lastMyGuess = '';
        if (langMode === "auto" && !detectedLang) applyLobbyLang();
        possibleWords = filterHints(correctAnswers);
    }

    // Жёлтое "is close!" - про моё последнее слово (жёлтым бывает и "Copied room link", его пропускаем)
    else if (messageColor === "rgb(226, 203, 0)" && !message.includes(": ")) {
        if (!lastMyGuess || !previousWords.length || !message.toLowerCase().includes(lastMyGuess)) return;
        possibleWords = previousWords.filter(word => levenshteinDistance(norm(word), norm(lastMyGuess)) === 1);
    }

    // Сообщение игрока "ник: слово"
    else if (message.includes(": ")) {
        const idx = message.indexOf(": ");
        const username = message.slice(0, idx);
        const guess = message.slice(idx + 2).toLowerCase().trim();

        possibleWords = possibleWords.filter(word => norm(word) !== norm(guess));
        triedWords.add(norm(guess));

        if (!myUsername) myUsername = readMyName();

        if (username === myUsername) {
            lastMyGuess = guess;
            previousWords = possibleWords;
            possibleWords = possibleWords.filter(word => levenshteinDistance(norm(word), norm(guess)) === -1);
        }
    }

    // "The word was 'слово'" - подсказывает язык комнаты и пополняет словарь
    else {
        const m = message.match(/'([^']{2,})'\s*$/);
        if (!m) return;
        const word = m[1].toLowerCase().trim();
        detectLang(word);
        if (!correctAnswers.includes(word)) {
            correctAnswers.push(word);
            GM_setValue("correctAnswers", correctAnswers);
        }
        return;
    }

    generateGuesses();
}

function observeChat() {
    const target = document.querySelector(".chat-content");
    if (!target) return;

    // разбираем все новые сообщения, а не только последнее
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => m.addedNodes.forEach(node => {
            if (node.nodeType === 1) handleChatMessage(node);
        }));
    });

    observer.observe(target, { childList: true });
}

observeChat();


// ======================= АВТОУГАДЫВАНИЕ =======================
let autoGuessInterval;
let autoGuessing = false;

function startAutoGuessing() {
    if (!autoGuessing) return;

    autoGuessInterval = setInterval(() => {
        if (possibleWords.length > 0 && canSubmit() && !input.value.trim()) {
            submitGuess(possibleWords.shift());
        }
    }, 3500);
}

$("sw-auto").addEventListener("click", () => {
    autoGuessing = !autoGuessing;
    clearInterval(autoGuessInterval);
    autoGuessInterval = null;
    startAutoGuessing();
    refreshControls();
});


// ======================= ИИ ПО РИСУНКУ =======================
const aiShelf = $("ai-shelf");
const aiButton = $("ai-guess");

let aiKey = GM_getValue("aiKey", "");
const modelIdx = { gemini: GM_getValue("aiModelIndex_gemini", 0), anthropic: GM_getValue("aiModelIndex_anthropic", 0) };
let aiBusy = false;
let aiAuto = false;
let aiTimer = null;
let aiLastKey = "";

const AI_BUTTON_TEXT = "✨ ИИ: угадать";

// Gemini по умолчанию; Claude только если ключ начинается с sk-ant-
const providerId = () => (/^sk-ant-/.test(aiKey) ? "anthropic" : "gemini");

function currentModel() {
    const p = PROVIDERS[providerId()];
    return p.models[Math.min(modelIdx[providerId()] || 0, p.models.length - 1)];
}

// счётчик запросов за сегодня (полезно для бесплатных лимитов)
function aiCountToday() {
    const c = GM_getValue("aiCount", {});
    return c.date === new Date().toISOString().slice(0, 10) ? c.n : 0;
}

function bumpAiCount() {
    const date = new Date().toISOString().slice(0, 10);
    const c = GM_getValue("aiCount", {});
    GM_setValue("aiCount", { date, n: (c.date === date ? c.n : 0) + 1 });
    refreshControls();
}

function renderAI(words, note) {
    aiWordsShown = words;
    aiNote = words.length ? (note || "") : "";
    aiShelf.innerHTML = '';
    if (!words.length) return;
    aiShelf.appendChild(labelEl(note || "✨ ИИ думает:"));
    words.forEach(word => aiShelf.appendChild(makeChip(word, "ag-chip-ai")));
}

function setAiAuto(on) {
    aiAuto = on;
    clearInterval(aiTimer);
    aiTimer = aiAuto ? setInterval(() => askAI(true), PROVIDERS[providerId()].autoInterval) : null;
    refreshControls();
}

function askKey() {
    const value = window.prompt(
        "Вставь API-ключ:\n" +
        "  • Google Gemini (бесплатно): aistudio.google.com/apikey\n" +
        "  • или Anthropic Claude: ключ начинается с sk-ant-\n" +
        "Ключ хранится только в твоём браузере.\n" +
        "Оставь пустым и нажми OK, чтобы удалить ключ.",
        aiKey
    );
    if (value === null) return;
    aiKey = value.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, "");
    GM_setValue("aiKey", aiKey);
    if (aiAuto) setAiAuto(true);        // перезапускаем таймер под нового провайдера
    refreshControls();
    if (aiKey) toast(`Ключ сохранён (${PROVIDERS[providerId()].name}). Нажми «Проверить», чтобы убедиться, что он работает.`);
}

function getCanvas() {
    const main = document.querySelector("#game-canvas canvas");
    if (main && main.width) return main;
    // запасной вариант: самый большой холст на странице
    let best = null, bestArea = 0;
    document.querySelectorAll("canvas").forEach(c => {
        const area = c.width * c.height;
        if (area > bestArea) { best = c; bestArea = area; }
    });
    return best;
}

// Снимок рисунка: белый фон, JPEG в base64. null - если холст пуст.
function snapshot() {
    const src = getCanvas();
    if (!src || !src.width || !src.height) return null;

    const k = Math.min(1, 800 / src.width);
    const w = Math.round(src.width * k), h = Math.round(src.height * k);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);

    const data = ctx.getImageData(0, 0, w, h).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 16) {
        if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) ink++;
    }
    if (ink < 20) return null;

    return c.toDataURL("image/jpeg", 0.75).split(",")[1];
}

// быстрый "отпечаток" снимка, чтобы в авто-режиме не слать одно и то же
function hashShot(s) {
    let h = 0;
    for (let i = 0; i < s.length; i += 37) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h + ":" + s.length;
}

// Отправляет вопрос (и картинку, если есть) выбранному ИИ, возвращает текст ответа
async function callAI(prompt, shot) {
    const model = currentModel().id;

    if (providerId() === "gemini") {
        const parts = [];
        if (shot) parts.push({ inline_data: { mime_type: "image/jpeg", data: shot } });
        parts.push({ text: prompt });
        const generationConfig = { temperature: 0.2, maxOutputTokens: 2048 };
        if (shot) generationConfig.responseMimeType = "application/json";
        const data = await postJSON(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            { "content-type": "application/json", "x-goog-api-key": aiKey },
            { contents: [{ parts }], generationConfig }
        );
        return (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    }

    const content = [];
    if (shot) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: shot } });
    content.push({ type: "text", text: prompt });
    const data = await postJSON(
        "https://api.anthropic.com/v1/messages",
        { "content-type": "application/json", "x-api-key": aiKey, "anthropic-version": "2023-06-01" },
        { model, max_tokens: 200, messages: [{ role: "user", content }] }
    );
    return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
}

// понятный текст ошибки
function aiErrorText(e) {
    const m = e.message || "";
    if (/location is not supported/i.test(m)) return "Gemini недоступен в твоей стране. Включи VPN и попробуй снова.";
    if (/api key not valid|invalid x-api-key|authentication|HTTP 401|API_KEY_INVALID/i.test(m)) return "Неверный ключ. Проверь, что ключ скопирован целиком (кнопка «Задать»).";
    if (/credit|balance|billing/i.test(m)) return "Нет денег на балансе API.";
    if (/HTTP 429|quota|rate|RESOURCE_EXHAUSTED/i.test(m)) return "Лимит запросов исчерпан (в минуту или на сегодня). Подожди или смени модель.";
    if (/HTTP 404|not found|not supported/i.test(m)) return "Эта модель недоступна. Выбери другую в меню.";
    if (/HTTP 403|permission|PERMISSION_DENIED/i.test(m)) return "Доступ запрещён: ключ не разрешён для этого API или региона.";
    if (/HTTP 5\d\d|overloaded|unavailable/i.test(m)) return "Сервер ИИ перегружен. Повтори позже.";
    return "Ошибка ИИ: " + m.slice(0, 120);
}

async function testKey() {
    if (!aiKey) { askKey(); return; }
    toast("Проверяю ключ…", 15000);
    try {
        const text = await callAI("Ответь одним словом: ok");
        bumpAiCount();
        toast(`Ключ работает ✓  (${PROVIDERS[providerId()].name}, ответ: «${text.trim().slice(0, 30)}»)`, 6000);
    } catch (e) {
        console.error("[AutoGuesser] проверка ключа:", e);
        toast(aiErrorText(e), 9000);
    }
}

async function askAI(auto) {
    if (aiBusy) return;
    if (!aiKey) { if (!auto) { toast("Сначала задай ключ: ⚙ Меню → ИИ по рисунку → Задать."); askKey(); } return; }

    const info = readHints();
    if (!info.hints.length || info.allUncovered) {
        if (!auto) toast("Сейчас нечего угадывать: рисует не кто-то другой или слово уже открыто.");
        return;
    }

    const shot = snapshot();
    if (!shot) {
        if (!auto) toast("Рисунок пока пустой.");
        return;
    }

    // в авто-режиме не тратим запросы, если ничего не изменилось
    const key = hashShot(shot) + ":" + info.pattern + ":" + currentModel().id;
    if (auto && key === aiLastKey) return;
    aiLastKey = key;

    const candidates = possibleWords.filter(w => langOk(w) && !triedWords.has(norm(w))).slice(0, AI_MAX_CANDIDATES);
    const chars = Array.from(info.pattern);
    const known = chars.map((ch, i) => (ch !== "_" && ch !== " " && ch !== "-") ? `${i + 1}-я буква «${ch}»` : null).filter(Boolean);
    const tried = [...triedWords].slice(-40);
    const prompt =
        "Ты помогаешь угадать слово в игре Skribbl.io по рисунку на изображении (рисунок на белом фоне, может быть кривым и схематичным).\n" +
        `Подсказка: "${info.pattern}" - всего ${chars.length} символов ("_" - неизвестная буква).\n` +
        (known.length ? `Известные буквы: ${known.join(", ")}.\n` : "Открытых букв пока нет.\n") +
        "Ответ ОБЯЗАН подходить под подсказку: ровно такая длина и такие буквы на своих местах.\n" +
        (tried.length ? `Эти слова уже называли, они НЕ подходят: ${tried.join(", ")}.\n` : "") +
        (candidates.length ? `Слова из словаря, подходящие под подсказку: ${candidates.join(", ")}\n` : "") +
        "Действуй так: 1) кратко (до 12 слов) опиши, что нарисовано; 2) назови до 6 слов-ответов от самого вероятного. " +
        (candidates.length
            ? "Слово из списка выбирай ТОЛЬКО если оно правда соответствует рисунку. Если в списке нет подходящего, предложи свои слова, которые строго подходят под подсказку. "
            : "") +
        "Язык слов определи по буквам в подсказке (русский или английский).\n" +
        'Ответь ТОЛЬКО JSON без пояснений: {"seen": "что нарисовано", "words": ["слово1", "слово2"]}';

    aiBusy = true;
    const myTurn = turnId;
    aiButton.textContent = "⏳ ИИ думает…";
    try {
        const text = await callAI(prompt, shot);
        bumpAiCount();
        if (myTurn !== turnId) return;     // за время ответа начался новый ход - результат уже не нужен

        // ответ: {"seen": "...", "words": [...]}; запасной вариант - просто массив слов
        let list = [], seen = "";
        try {
            const mo = text.match(/\{[\s\S]*\}/);
            if (mo) {
                const obj = JSON.parse(mo[0]);
                list = obj.words || obj.слова || [];
                seen = String(obj.seen || obj.видно || "").trim();
            } else {
                const ma = text.match(/\[[\s\S]*\]/);
                list = JSON.parse(ma ? ma[0] : text);
            }
        } catch (e) { /* ответ не JSON */ }

        // оставляем только слова, подходящие под ТЕКУЩУЮ подсказку и ещё не названные
        const fresh = readHints();
        const words = [...new Set(
            (Array.isArray(list) ? list : []).filter(w => typeof w === "string")
                .map(w => w.toLowerCase().trim())
                .filter(w => fresh.regex.test(norm(w)) && !triedWords.has(norm(w)))
        )].slice(0, 6);

        const shortSeen = seen.length > 70 ? seen.slice(0, 67) + "…" : seen;
        renderAI(words, shortSeen ? `✨ ИИ видит «${shortSeen}»:` : "✨ ИИ думает:");
        if (!words.length) toast(shortSeen ? `ИИ видит «${shortSeen}», но подходящего под подсказку слова не нашёл.` : "ИИ не нашёл ничего подходящего под подсказку.", 6000);
    } catch (e) {
        console.error("[AutoGuesser] ИИ:", e);
        const msg = aiErrorText(e);
        toast(msg, 8000);
        // чтобы не сыпать ошибками каждые несколько секунд, авто-режим выключаем
        if (aiAuto && /Неверный ключ|Лимит|баланс|Доступ|стране/.test(msg)) { setAiAuto(false); toast("ИИ-авто выключен. " + msg, 9000); }
    } finally {
        aiBusy = false;
        aiButton.textContent = AI_BUTTON_TEXT;
    }
}

aiButton.addEventListener("click", () => askAI(false));
$("ai-key").addEventListener("click", askKey);
$("ai-test").addEventListener("click", testKey);
$("sw-aiauto").addEventListener("click", () => {
    if (!aiAuto && !aiKey) { askKey(); if (!aiKey) return; }
    setAiAuto(!aiAuto);
});
function stepModel(d) {
    const id = providerId(), n = PROVIDERS[id].models.length;
    modelIdx[id] = ((modelIdx[id] || 0) + d + n) % n;
    GM_setValue("aiModelIndex_" + id, modelIdx[id]);
    refreshControls();
}
$("ai-model-prev").addEventListener("click", () => stepModel(-1));
$("ai-model-next").addEventListener("click", () => stepModel(1));


// ======================= ОБНОВЛЕНИЕ ЭЛЕМЕНТОВ МЕНЮ =======================
function refreshControls() {
    const on = (id, v) => $(id).classList.toggle("on", !!v);
    on("sw-auto", autoGuessing);
    on("sw-last", autoLast);
    on("cs-soft", colorStyle === "soft"); on("cs-bright", colorStyle === "bright"); on("cs-dot", colorStyle === "dot");
    on("sz-s", chipSize === "s"); on("sz-m", chipSize === "m"); on("sz-l", chipSize === "l");
    on("gap-1", guessGap === 800); on("gap-2", guessGap === 1200); on("gap-3", guessGap === 2000);
    root.classList.remove("ag-size-s", "ag-size-m", "ag-size-l");
    root.classList.add("ag-size-" + chipSize);
    on("sw-colors", colorsOn);
    on("sw-aiauto", aiAuto);
    on("view-strip", !gridMode); on("view-grid", gridMode);
    on("seg-auto", langMode === "auto"); on("seg-ru", langMode === "ru"); on("seg-en", langMode === "en");
    on("scope-cand", searchScope === "cand"); on("scope-all", searchScope === "all");
    $("guess-shelf").classList.toggle("wrap", gridMode);

    const names = { auto: "Авто", ru: "Русский", en: "English" };
    const det = (langMode === "auto" && detectedLang) ? ` (${detectedLang.toUpperCase()})` : "";
    $("lang-mode").textContent = `🌐 ${names[langMode]}${det}`;

    const p = PROVIDERS[providerId()];
    $("ai-key-state").textContent = aiKey ? `✓ ${p.name} · сегодня: ${aiCountToday()}` : "не задан";
    $("ai-model-label").textContent = currentModel().label;
    $("ai-auto-hint").textContent = `Каждые ${p.autoInterval / 1000} с, если рисунок изменился. ` +
        (providerId() === "gemini" ? "Быстро тратит бесплатный лимит!" : "Тратит баланс.");
}

refreshControls();


// ======================= ЭКСПОРТ =======================
async function exportNewWords() {
    // слова, которых нет в твоих словарях на GitHub - то, что скрипт выучил в игре
    const old = new Set();
    const urls = RU_WORDLIST_URLS.concat(ENABLE_ENGLISH
        ? [EN_WORDLIST_URL, "https://raw.githubusercontent.com/zkisaboss/skribbl-autoguesser/main/wordlist.txt"]
        : []);
    for (const url of urls) (await fetchWords(url)).forEach(w => old.add(w));

    const data = correctAnswers.filter(word => !old.has(word) && !old.has(norm(word)));
    if (!data.length) { toast("Нечего экспортировать: новых слов нет."); return; }

    const url = URL.createObjectURL(new Blob([data.join('\n')], { type: "text/plain" }));
    try {
        const anchor = Object.assign(document.createElement('a'), { href: url, download: "newWords.txt" });
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        toast(`Сохранено новых слов: ${data.length} (файл newWords.txt)`);
    } finally {
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }
}

$("export-answers").addEventListener("click", exportNewWords);
$("dict-refresh").addEventListener("click", fetchAndStoreLatestWordlists);
$("dict-reset").addEventListener("click", resetDictionary);


// ======================= "СЕКРЕТ" =======================
const secretButton = $("get-special");

function runSecret() {
    const avatars = document.querySelectorAll(".avatar-container .avatar");

    const interval = setInterval(() => {
        let allSecretsVisible = true;

        avatars.forEach(avatar => {
            const secret = avatar.querySelector(".special");

            if (getComputedStyle(secret).display === "none") {
                avatar.click();
                allSecretsVisible = false;
            }
        });

        if (allSecretsVisible) clearInterval(interval);
    }, 15);
}

secretButton.addEventListener("click", runSecret);


function observeSecret() {
    const target = document.getElementById("home");
    if (!target) return;

    const observer = new MutationObserver(() => {
        secretButton.style.display = target.hasAttribute("style") ? "none" : "inline-block";
    });

    observer.observe(target, { attributes: true, attributeFilter: ["style"] });
}

observeSecret();
})();
