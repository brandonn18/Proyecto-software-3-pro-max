-- M-04 / M-01: marcas de la alerta del 80 % y del vencimiento del SLA (equivalente a ../mysql/V2__marcas_sla.sql).
alter table ticket add column alerta_sla_en timestamp(6) with time zone;
alter table ticket add column sla_vencido_en timestamp(6) with time zone;
