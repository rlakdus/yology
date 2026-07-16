# export_cda.fixed.xml 구조 설명

`data/export_cda.fixed.xml`은 Apple 건강 앱 데이터를 Health Auto Export류 앱이
**HL7 CDA R2(Clinical Document Architecture)** 표준 포맷으로 내보낸 문서다.
원본(`data/export_cda.xml`)은 XML 정합성이 깨져 있어([아래 참고](#원본-대비-수정된-부분)),
`scripts/parse_cda.py`로 보정한 결과가 이 파일이다.

## 전체 트리 구조

```
ClinicalDocument                         ← 루트, xmlns="urn:hl7-org:v3"
├─ Header (문서 메타데이터, 파일당 1번)
│   ├─ realmCode / typeId / templateId / id
│   ├─ code            (LOINC 34109-9 "Note")
│   ├─ title            "Health Data Export"
│   ├─ effectiveTime     내보낸 시각
│   ├─ confidentialityCode
│   └─ recordTarget > patientRole > patient
│        ├─ administrativeGenderCode   ← 성별
│        └─ birthTime                  ← 생년월일 (YYYYMMDD)
│
└─ Body: component > section            ← 원본에서 여는 태그가 누락됐던 부분
    ├─ entry[1] (typeCode="DRIV")
    │   └─ organizer (classCode="CLUSTER", moodCode="EVN")
    │        ├─ code            46680005 "Vital signs" (SNOMED CT)
    │        ├─ id               UUID
    │        ├─ effectiveTime    이 묶음 데이터의 최초~최후 시각 범위
    │        └─ component × 1,906
    │             └─ observation  → LOINC 8867-4 "Heart rate"
    ├─ entry[2]
    │   └─ organizer (entry[1]과 code/id/templateId 동일)
    │        └─ component × 34
    │             └─ observation  → LOINC 2710-2 "Oxygen saturation"
    └─ entry[3]
        └─ organizer (entry[1]과 code/id/templateId 동일)
             └─ component × 13
                  └─ observation  → LOINC 9279-1 "Respiratory rate"
```

- `entry`는 3개, 각각 `organizer` 1개씩을 감싼다.
- 총 observation 수: **1,953건** (1,906 + 34 + 13).

## 계층별 값이 실제로 구분되는지 여부

이 파일에서 값으로 실질적인 구분이 가능한 계층은 **observation 하나뿐**이다.
그 위 계층(entry, organizer)은 전부 동일한 값을 재사용하는 고정 템플릿이다.

| 계층 | 개수 | 값으로 구분 가능? | 실제로 확인된 내용 |
|---|---|---|---|
| `ClinicalDocument` | 1 | - | 환자 성별/생년월일, 내보낸 시각 (파일 전체 공통) |
| `entry` | 3 | ❌ | `typeCode="DRIV"`로 3개 전부 동일 |
| `organizer` | 3 | ❌ (거의) | `code`(46680005 "Vital signs"), `id`(`c6f88320-...`), `templateId` — **3개 전부 완전히 같은 값**. 유일하게 다른 값은 `effectiveTime low/high`(그 묶음 안 데이터의 시간 범위)뿐 |
| `component` | 1,953 | ❌ | 속성 없는 순수 wrapper |
| `observation` | 1,953 | ✅ | 아래 표 참고 |

즉 "이게 심박수 묶음인지 산소포화도 묶음인지"는 organizer 자체 값으로는 알 수 없고,
그 안의 **observation의 `code`**를 봐야 알 수 있다.

## observation 필드 상세

```xml
<observation classCode="OBS" moodCode="EVN">
 <templateId root="2.16.840.1.113883.10.20.22.4.27"/>
 <id root="c6f88321-67ad-11db-bd13-0800200c9a66"/>          <!-- 1,953건 전부 동일값, PK 아님 -->
 <code code="8867-4" codeSystem="2.16.840.1.113883.6.1"
       codeSystemName="LOINC" displayName="Heart rate"/>     <!-- 실질적 항목 구분자 -->
 <text>
  <sourceName>김하은의 Apple Watch</sourceName>
  <sourceVersion>26.5</sourceVersion>
  <device>&lt;&lt;HKDevice: ...&gt;&gt;</device>
  <value>99</value>
  <type>HKQuantityTypeIdentifierHeartRate</type>
  <unit>count/min</unit>
  <metadataEntry>
   <key>HKMetadataKeyHeartRateMotionContext</key>
   <value>0</value>
  </metadataEntry>
 </text>
 <statusCode code="completed"/>
 <effectiveTime>
  <low value="20260701193041+0900"/>
  <high value="20260701193041+0900"/>
 </effectiveTime>
 <value xsi:type="PQ" value="99" unit="count/min"/>           <!-- 표준화된 수치+단위 -->
 <interpretationCode code="N" codeSystem="2.16.840.1.113883.5.83"/>
</observation>
```

| 필드 | 의미 | 비고 |
|---|---|---|
| `id` | HL7 표준상 고유 식별자 | **이 파일에선 전부 동일값이라 실제로는 무의미** |
| `code` | LOINC 코드/표시명 | 항목 구분에 쓰이는 유일한 값 (8867-4/2710-2/9279-1) |
| `text > sourceName/sourceVersion/device` | 측정 기기 정보 | Apple HealthKit 원본 그대로 |
| `text > value/type/unit` | HealthKit 원본 값 (CDA `value`와 별개로 중복 기록됨) | `type`은 `HKQuantityTypeIdentifier...` 식별자 |
| `text > metadataEntry` | 부가 메타데이터 | 항목마다 키가 다름 (아래 표 참고) |
| `effectiveTime low/high` | 측정 시각 | `YYYYMMDDHHMMSS±ZZZZ` 포맷, 이 파일은 low=high (순간 측정) |
| `value[xsi:type="PQ"]` | 표준 CDA 수치+단위 (Physical Quantity) | 정규화 시 이 값을 사용 |
| `interpretationCode` | 정상/비정상 해석 | `N`=정상 |

## 항목별 데이터 특성

| 항목 | LOINC | 개수 | 단위 | metadataEntry 키 | 비고 |
|---|---|---|---|---|---|
| Heart rate | 8867-4 | 1,906 | `count/min` | `HKMetadataKeyHeartRateMotionContext` | 대부분의 데이터, 없는 observation도 존재 |
| Oxygen saturation | 2710-2 | 34 | `%` | `HKMetadataKeyBarometricPressure` | **값이 `0.97`처럼 비율(0~1)로 기록됨** — %로 보려면 ×100 필요 |
| Respiratory rate | 9279-1 | 13 | `count/min` | 없음 | metadataEntry 자체가 없는 observation 다수 |

## 원본 대비 수정된 부분

원본 `data/export_cda.xml`은 body를 감싸는 `<component><section>`의 **여는 태그가 누락**되어 있고
파일 끝에 닫는 태그(`</section></component>`)만 남아 있어 XML 정합성 검사(`xmllint`)를 통과하지 못했다.

```
data/export_cda.xml:50783: Opening and ending tag mismatch: ClinicalDocument line 3 and section
```

`scripts/parse_cda.py`의 `fix_xml()`이 `</recordTarget>` 바로 뒤에
`<component>` / `<section>` 여는 태그를 삽입해 보정한 결과가 이 파일(`export_cda.fixed.xml`)이다.
원본 파일 자체는 수정하지 않는다.

## 관련 파일

- `data/export_cda.xml` — 원본 (정합성 깨짐, 미수정)
- `data/export_cda.fixed.xml` — 이 문서가 설명하는 대상, 정합성 보정본
- `data/export_cda_normalized.csv` — observation 1,953건을 long-format으로 평탄화한 결과
- `scripts/parse_cda.py` — 위 세 파일을 생성하는 스크립트
